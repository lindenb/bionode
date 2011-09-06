var bgzf=require("bgzf");
var Buffer = require('buffer').Buffer;


function BamReader(path)
	{
	this.fd=new bgzf.bgzf(path,"r");
	var b=new Buffer(4);
	var n = this.fd.read(b,0,4);
	if(n!=4) throw new Error("Cannot read 4 bytes");
	if(b[0]!=66)  throw new Error("Error MAGIC[0]");
	if(b[1]!=65)  throw new Error("Error MAGIC[1] got"+b[1]);
	if(b[2]!="M".charCodeAt(0))  throw new Error("Error MAGIC[2]");
	if(b[3]!="\1".charCodeAt(0))  throw new Error("Error MAGIC[3]");
	
	/* l_text */
	n = this.fd.read(b,0,4);
	if(n!=4) throw new Error("Cannot read 4 bytes");
	var l_text=b.readInt32LE(0);
	b=new Buffer(l_text);
	n = this.fd.read(b,0,l_text);
	if(n!=l_text) throw new Error("Cannot read "+l_text+" bytes (l_text)");
	this.text=b.toString('utf-8', 0, l_text);
	
	/* n_seq */
	b=new Buffer(4);
	n = this.fd.read(b,0,4);
	if(n!=4) throw new Error("Cannot read 4 bytes");
	var n_ref=b.readInt32LE(0);
	this.references=[];
	this.name2seq={};
	for(var i=0;i< n_ref;++i)
		{
		var refseq={};
		/* l_name */
		b=new Buffer(4);
		n = this.fd.read(b,0,4);
		if(n!=4) throw new Error("Cannot read 4 bytes");
		var l_name=b.readInt32LE(0);
		/* name */
		b=new Buffer(l_name);
		n = this.fd.read(b,0,l_name);
		if(n!=l_name) throw new Error("Cannot read "+l_name+" bytes (name)");
		refseq.name=b.toString('utf-8', 0,l_name-1);//\0 terminated
		/* l_ref */
		b=new Buffer(4);
		n = this.fd.read(b,0,4);
		if(n!=4) throw new Error("Cannot read 4 bytes");
		refseq.l_ref=b.readInt32LE(0);
		this.references.push(refseq);
		this.name2seq[refseq.name]=refseq;
		}
	console.log(this.name2seq);
	}

BamReader.prototype.close = function() 
	{
 	return this.fd.close();
	};

BamReader.prototype.next = function() 
	{
	
	/* block size */
	var b=new Buffer(4);
	var n = this.fd.read(b,0,4);
	if(n==0) return null;//EOF met
	
	var align={};
	
	if(n!=4) throw new Error("Cannot read 4 bytes");
	var block_size=b.readInt32LE(0);
	
	/* refID */
	b=new Buffer(32);
	n = this.fd.read(b,0,32);
	if(n!=32) throw new Error("Cannot read 32 bytes.");
	align.refID = b.readInt32LE(0);
	align.pos = b.readInt32LE(4);
	/* bin_mq_nl */
	var byte2= b.readUInt32LE(8);
	align.bin = byte2 >> 16;
	align.mq = byte2 >>8&0xff;
	align.name_len = byte2&0xff;
	/* flag nc */
	var byte3= b.readInt32LE(12);
	align.flag = byte3 >>16;
	align.n_cigar = byte3&0xffff;
	/* l_seq */
	align.l_qseq = b.readInt32LE(16);
	/* next refID */
	align.next_refID = b.readInt32LE(20);
	/* next_pos */
	align.next_pos = b.readInt32LE(24);
	/* tlen */
	align.tlen = b.readInt32LE(28);
	
	/* read name */
	var data_len= block_size - 32;
	b=new Buffer( data_len);
	n = this.fd.read(b,0, data_len);
	if(n!= data_len) throw new Error("Cannot read "+ data_len+" bytes.");
	align.read_name = b.toString('ascii',0, align.name_len-1);
	
	/* cigar */
	align.cigar= b.slice(align.name_len,align.name_len+4*(align.n_cigar));
	
 	return align;
	};


console.log(BamReader);
var r=new BamReader("/home/lindenb/samtools-0.1.17/examples/toy.bam");
var align;
while((align=r.next())!=null)
	{
	console.log(
		r.references[align.refID].name+"\t"+
		align.read_name+"\t"+
		align.pos
		);
	}
console.log(r.close());
console.log("DONE");
