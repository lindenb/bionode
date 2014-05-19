
var mysql = require('mysql');


var connection = mysql.createConnection({
  debug:true,
  trace:true,
 
  host : 'genome-mysql.cse.ucsc.edu',
  port : 3306,
  database: 'hg19',
  user : 'genome'
})
connection.connect(function(err) {if(err!=null) console.log(err);});



connection.end();

/*

$ node test2.js
{ [Error: connect ECONNREFUSED]
  code: 'ECONNREFUSED',
  errno: 'ECONNREFUSED',
  syscall: 'connect',
  fatal: true }



$ mysql -A -u genome -h genome-mysql.cse.ucsc.edu -P 3306 -D hg19 -e 'select now()'
+---------------------+
| now()               |
+---------------------+
| 2014-03-06 01:56:36 |
+---------------------+


*/
