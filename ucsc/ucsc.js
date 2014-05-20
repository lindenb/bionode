/**
 * Author: Pierre Lindenbaum PhD
 * Date:   2014
 * Motivation: REST API for the UCSC mysql server
 */
var mysql = require('mysql');
var http = require('http');
var restify = require('restify');



/** initial connection pool */
var connectionPool = mysql.createPool({
  host : 'genome-mysql.cse.ucsc.edu',
  port : 3306,
  database: 'hg19',
  user : 'genome',
  password : ''
  
 });

/** call used to print data */
function PrintRows(res /* output stream */)
	{
	this.res=res;
	this.count=0;
	this.callback=null;
	}
	
	
/* print the next row */
PrintRows.prototype.next=function(r)
	{
	if(this.count==0)
		{
		this.res.writeHead(200, {"Content-Type":(this.callback? "application/javascript" : "application/json")});
		if(this.callback!=null) this.res.write(this.callback+"(");
		this.res.write("[\n");
		}
	else
		{
		this.res.write(",\n");	
		}
	this.res.write(JSON.stringify(r));
	this.count++;
	};
/* called when end of query */
PrintRows.prototype.close=function()
	{
	if(this.count==0)
		{
		this.res.writeHead(200, {"Content-Type":(this.callback? "application/javascript" : "application/json")});
		if(this.callback!=null) this.res.write(this.callback+"(");
		this.res.write("[\n");
		}
	if(this.count>0) this.res.write("\n");
	this.res.write("]");
	if(this.callback!=null) this.res.write(");");
	this.res.end();
	};

/* called on error */
PrintRows.prototype.error=function(err)
	{
	this.res.status(500);
	this.res.end(""+err);
	};

/* class used to cache the SCHEMA of a database.table */
function Schema(database,table)
	{
	this.database=database;
	this.table=table;
	/* list of fields */
	this.fields=[];
	}

/** cache for table descriptions */
Schema.ALL={};

/** qualified name for this database.table */
Schema.prototype.getQName=function()
	{
	return this.database+"."+this.table;
	};

/** get field by name */
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

/**  return the field 'chrom' */
Schema.prototype.getChrom=function()
	{
	return this.getFieldByName("chrom") || this.getFieldByName("tName");
	};
/**  return the field 'start' */
Schema.prototype.getChromStart=function()
	{
	var f= this.getFieldByName("chromStart");
	if(f==null) f= this.getFieldByName("txStart");
	if(f==null) f= this.getFieldByName("cdsStart");
	if(f==null) f= this.getFieldByName("tStart");
	return f;
	};
/**  return the field 'end' */
Schema.prototype.getChromEnd=function()
	{
	var f= this.getFieldByName("chromEnd");
	if(f==null) f= this.getFieldByName("txEnd");
	if(f==null) f= this.getFieldByName("cdsEnd");
	if(f==null) f= this.getFieldByName("tEnd");
	return f;
	};
/**  return wether table contain chrom/start/end */
Schema.prototype.isGenomicRange=function()
	{
	return this.getChrom()!=null && this.getChromStart()!=null && this.getChromEnd()!=null;
	};

/* return true if field is indexed */
Schema.prototype.hasIndex=function(column)
	{
	var field= this.getFieldByName(column);
	return field!=null && field.key!="";
	};

Schema.prototype.toString=function()
	{
	return JSON.stringify(this);
	};

/* UCSC bin array generator */
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

/** return comma-separated list of field for select */
Schema.prototype.selectFields=function()
	{
	var sql="";
	for(var c in this.fields)
		{
		var f=this.fields[c];
		if(sql.length!=0) sql+=",";
		if(f.type.indexOf("blob")!=-1)
			{
			sql+="CONVERT("+f.name+"  USING utf8) as `"+f.name+"`" ;
			}
		else
			{
			sql+=f.name;
			}
		}
	return sql;
	}

/** return data by genomic range */
Schema.prototype.selectByRange=function(range,callback,res)
	{
	
	var table=this;
	var qName=this.getQName();
	var printer=new PrintRows(res);
	printer.callback=callback;

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
		
		
		
		var sql="select ";
		sql+= table.selectFields();
		sql+=" from "+table.getQName() + " where "
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

/** return data by indexed column */
Schema.prototype.selectByColumn=function(column,value,callback,res)
	{
	var thisSchema=this;
	var qName=this.getQName();
	var printer=new PrintRows(res);
	printer.callback=callback;
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
		
		var query= connection.query("select "+ thisSchema.selectFields()+" from "+qName+ " where "+column+"=?",[value]);
		
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


/** fetch data schema */
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


/** get all databases */
server.get('/schemas/databases', function(req,res,next)
	{
	var printer=new PrintRows(res);
	printer.callback=req.params.callback;
	console.log("getting databases list");
	connectionPool.getConnection(function(err,connection)
		{
		if(err!=null) 
			{
			console.log("err:"+err);
			printer.error(err);
			return;
			}
		
		var query= connection.query("show databases");
		
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
			//just print the name of the database
			for(var k in row) { printer.next(row[k]); break;}
			})
			.on('end',function()
			{
			printer.close();
			connection.release();
			});
	
		});
	});


/** get all tables for a given databases */
server.get('/schemas/:database/tables', function(req,res,next)
	{
	var printer=new PrintRows(res);
	printer.callback=req.params.callback;
	console.log("getting table list");
	connectionPool.getConnection(function(err,connection)
		{
		if(err!=null) 
			{
			console.log("err:"+err);
			printer.error(err);
			return;
			}
		
		var query= connection.query("show tables from "+req.params.database);
		
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
			//just print the name of the database
			for(var k in row) { printer.next(row[k]); break;}
			})
			.on('end',function()
			{
			printer.close();
			connection.release();
			});
	
		});
	});

/** callback for get table description */
server.get('/schemas/:database/:table', function(req,res,next)
	{
	console.log("getting schema for database/table");
	var callback=req.params.callback;
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
		res.writeHead(200, {"Content-Type":(callback? "application/javascript" : "application/json")});
		if(callback) res.write(callback+"(");
		res.write(JSON.stringify(t));
		if(callback) res.write(");");
		res.end();
		});
	});

/** callback for get field by name */
server.get('/ucsc/:database/:table/:column/:key', function(req,res,next)
	{
	console.log("getting database: field by name");
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
			req.params.callback,
			res);
		});
	});


/** callback for data by range */
server.get('/ucsc/:database/:table', function(req,res,next)
	{
	console.log("getting database: field by range");
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
			req.params.callback,
			res);
		});
	});


server.listen(8080)

console.log('Server running at http://localhost:8080/');
