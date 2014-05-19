var mysql = require('mysql');
var http = require('http');
var restify = require('restify');
var ucscSchema={};
var connectionPool = mysql.createPool({
  host : 'genome-mysql.cse.ucsc.edu',
  port : 3306,
  database: 'hg19',
  user : 'genome',
  password : ''
  
 });

function PrintRows(res)
	{
	this.res=res;
	this.count=0;
	}
PrintRows.prototype.next=function(r)
	{
	if(this.count==0)
		{
		this.res.write("[\n");
		}
	else
		{
		this.res.write(",\n");	
		}
	this.res.write(JSON.stringify(r));
	this.count++;
	};
PrintRows.prototype.close=function()
	{
	if(this.count==0) this.res.write("[\n");
	if(this.count>0) this.res.write("\n");
	this.res.end("]");
	};
	
PrintRows.prototype.error=function(err)
	{
	this.res.status(500);
	this.res.end(""+err);
	};


function Schema(database,table)
	{
	this.database=database;
	this.table=table;
	this.fields=[];
	}

Schema.ALL={};

Schema.prototype.getQName=function()
	{
	return this.database+"."+this.table;
	};

Schema.prototype.getFieldByName=function(column)
	{
	if(column==null) return null;
	for(var c in this.fields)
		{
		var f=this.fields[c];
		if(f.name == column) return f;
		}
	return null;
	};

Schema.prototype.getChrom=function()
	{
	return this.getFieldByName("chrom");
	};
Schema.prototype.getChromStart=function()
	{
	var f= this.getFieldByName("chromStart");
	if(f==null) f= this.getFieldByName("txStart");
	if(f==null) f= this.getFieldByName("cdsStart");
	return f;
	};
Schema.prototype.getChromEnd=function()
	{
	var f= this.getFieldByName("chromEnd");
	if(f==null) f= this.getFieldByName("txEnd");
	if(f==null) f= this.getFieldByName("cdsEnd");
	return f;
	};
Schema.prototype.isGenomicRange=function()
	{
	return this.getChrom()!=null && this.getChromStart()!=null && this.getChromEnd()!=null;
	};

Schema.prototype.hasIndex=function(column)
	{
	var field= this.getFieldByName(column);
	return field!=null && field.key!="";
	};

Schema.prototype.toString=function()
	{
	return JSON.stringify(this);
	};


Schema.reg2bins=function(beg,end)
	{
	var list=[];
	var k;
	if (beg >= end) return list;
	if (end >= 1<<29) end = 1<<29;
	--end;
	list.push(0);
	for (k =    1 + (beg>>26); k <=    1 + (end>>26); ++k) list.push(k);
	for (k =    9 + (beg>>23); k <=    9 + (end>>23); ++k) list.push(k);
	for (k =   73 + (beg>>20); k <=   73 + (end>>20); ++k) list.push(k);
	for (k =  585 + (beg>>17); k <=  585 + (end>>17); ++k) list.push(k);
	for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
	return list;
	}


Schema.prototype.selectByRange=function(range,res)
	{
	var table=this;
	var qName=this.getQName();
	var printer=new PrintRows(res);
	if(!this.isGenomicRange())
		{
		printer.error(this.getQName()+" is not genomic range");
		return;
		}
		
	connectionPool.getConnection(function(err,connection)
		{
		if(err!=null) 
			{
			console.log("err:"+err);
			printer.error(err);
			return;
			}
		
		
		
		var sql="select * from "+table.getQName() + " where "
				+table.getChrom().name+" = ?"+
				" AND NOT(? < "+table.getChromStart().name+" OR ? >="+table.getChromEnd().name+")"
				;
		
		
		if(table.getFieldByName("bin")!=null)
			{
			sql+=" and bin in(-999";
			
			var binArray=Schema.reg2bins(range.start,range.end);
			console.log(binArray);
			for(var i in binArray)
				{
				sql+=(","+binArray[i]);
				}
			sql+=")";
			}
		console.log(sql);
		var query= connection.query(
				sql,
				[range.chrom,range.end,range.start]
				);
	
		query.on('error',function(err)
			{
			printer.error(err);
			})	
			.on('field',function(fields)
			{
			//nothing
			})
			.on('result',function(row)
			{
			printer.next(row);
			})
			.on('end',function()
			{
			printer.close();
			connection.release();
			});
			
		});
	}


Schema.prototype.selectByColumn=function(column,value,res)
	{
	var qName=this.getQName();
	var printer=new PrintRows(res);
	if(!this.hasIndex(column))
		{
		printer.error(this.getQName()+" has no indexed column "+column+" ");
		return;
		}
		
	connectionPool.getConnection(function(err,connection)
		{
		if(err!=null) 
			{
			console.log("err:"+err);
			printer.error(err);
			return;
			}
		
		var query= connection.query("select * from "+qName+ " where "+column+"=?",[value]);
		
		query.on('error',function(err)
			{
			printer.error(err);
			})	
			.on('field',function(fields)
			{
			//nothing
			})
			.on('result',function(row)
			{
			printer.next(row);
			})
			.on('end',function()
			{
			printer.close();
			connection.release();
			});
	
		});
	}

Schema.get=function(table,callback)
	{
	if(table.getQName() in Schema.ALL)
		{
		table=Schema.ALL[table.getQName()];
		console.log("ALL "+table);
		callback(null,table);
		return;
		}
	
	connectionPool.getConnection(function(err,connection)
		{
		if(err!=null) 
			{
			console.log("err:"+err);
			callback(err,null);
			return;
			}
		
		connection.query("desc "+table.getQName(),function(err, rows, fields)
			{
			if(err)
				{
				callback(err, null);
				connection.release();
				return;
				}
				
			for(var r in rows)
				{
				var row=rows[r];
				
				table.fields.push(
					{
					"name": row['Field'],
					"type": row['Type'],
					"key": row['Key']
					});
				
				}
			Schema.ALL[table.getQName()]=table;
			
			callback(null, table);
			connection.release();
			});
		});
	}



function send(req, res, next)
   {
   res.send('Params: ' + req.params.table);
   return next();/* run the next handler in the chain */
   }


var server = restify.createServer({
  name: 'UCSC'
});
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());/* Cross-origin resource sharing */

server.get('/schemas/:database/:table', function(req,res,next)
	{
	var table=new Schema(req.params.database,req.params.table);
	Schema.get(table,function(err,t)
		{
		if(err!=null)
			{
			console.log(err);
			res.status(500);
			res.send(err);
			return;
			}
		console.log("t="+t);
		res.writeHead(200, {"Content-Type": "application/json"});
		res.end(JSON.stringify(t));
		});
	});

server.get('/ucsc/:database/:table/:column/:key', function(req,res,next)
	{

	var table=new Schema(req.params.database,req.params.table);
	Schema.get(table,function(err,t)
		{
		if(err!=null)
			{
			res.status(500);
			res.send(err);
			return;
			}
		t.selectByColumn(
			req.params.column,
			req.params.key,
			res);
		});
	});

server.get('/ucsc/:database/:table', function(req,res,next)
	{

	var table=new Schema(req.params.database,req.params.table);
	Schema.get(table,function(err,t)
		{
		if(err!=null)
			{
			res.status(500);
			res.send(err);
			return;
			}
		if(!t.isGenomicRange())
			{
			res.status(500);
			res.send("table "+t.getQName()+" is not genomic range");
			return;
			}
		var range=null;
		try
			{
			range=	{
				"chrom":req.params.chrom,
				"start":parseInt(req.params.start,10),
				"end":parseInt(req.params.end,10)
				};
			if(!req.params.chrom || isNaN(range.start) || isNaN(range.end) || range.start>range.end || range.start<0 )
				{
				throw "Bad range "+range;
				}
			}
		catch(err)
			{
			res.status(500);
			res.send(err);
			return;
			}
		t.selectByRange(
			range,
			res);
		});
	});


server.listen(8080)

console.log('Server running at http://localhost:8080/');
