Node.js and Bioinformatics

# UCSC
A REST server for the mysql server of the UCSC.

## Installation 

### Versions used:
```bash
$ npm -v
1.4.3
$ node -v
v0.10.26
```

### Install mysql for Node.js
```bash
$ npm install mysql
(...)
mysql@2.3.0 node_modules/mysql
├── require-all@0.0.8
├── bignumber.js@1.4.0
└── readable-stream@1.1.13-1 (isarray@0.0.1, inherits@2.0.1, string_decoder@0.10.25-1, core-util-is@1.0.1)
```

test the connection
```bash
$ node test/ucsc_mysql.js
<-- HandshakeInitializationPacket
{ protocolVersion: 10,
  serverVersion: '5.6.10-log',

(...)

  changedRows: 0 }

--> ComQuitPacket
{ command: 1 }

```

### Install restify for Node.js
```bash
$  npm install restify
(...)
restify@1.4.4 ../node_modules/restify 
├── byline@2.0.2
├── lru-cache@1.1.0
├── semver@1.0.14
├── retry@0.6.0
├── mime@1.2.5
├── async@0.1.22
├── node-uuid@1.3.3
├── formidable@1.0.11
├── bunyan@0.10.0
├── qs@0.5.0
├── http-signature@0.9.9 (asn1@0.1.11 ctype@0.5.0)
└── dtrace-provider@0.0.9
```


