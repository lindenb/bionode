/* This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. See the accompanying 
 * LICENSE file.
 */
/*
../node-v0.4.10/src/node_file.cc
https://www.cloudkick.com/blog/2010/aug/23/writing-nodejs-native-extensions/

export PATH=${PATH}:/home/lindenb/tmp/NODEJS/bin
node-waf configure
node-waf build
export NODE_PATH=/home/lindenb/tmp/NODEJS/my-extension/build/default

*/
#include <v8.h>
#include <node.h>
#include <node_buffer.h>
#include "throw.h"
#include "bgzf.h"

using namespace node;
using namespace v8;
#define THROW_BAD_ARGS \
  ThrowException(Exception::TypeError(String::New("Bad argument")))

// Extracts a C string from a V8 Utf8Value.
static const char* ToCString(const v8::String::Utf8Value& value) {
  return *value ? *value : "<string conversion failed>";
}



/**
 *
 * BGZF wrapper
 *
 */
class BGZFSupport: public ObjectWrap
{
private:
  BGZF* file;
public:

  static Persistent<FunctionTemplate> s_ct;
  static void Init(Handle<Object> target)
  	{
    	HandleScope scope;

    	Local<FunctionTemplate> t = FunctionTemplate::New(New);

    	s_ct = Persistent<FunctionTemplate>::New(t);
    	s_ct->InstanceTemplate()->SetInternalFieldCount(1);
    	s_ct->SetClassName(String::NewSymbol("bgzf"));

    	NODE_SET_PROTOTYPE_METHOD(s_ct, "close", Close);
	NODE_SET_PROTOTYPE_METHOD(s_ct, "read", Read);
    	target->Set(String::NewSymbol("bgzf"), s_ct->GetFunction());
  	}

  BGZFSupport(BGZF* file):file(file)
  	{
  	}
  
  int close()
  	{
  	int ret=0;
  	if(file!=NULL) ret=::bgzf_close(file);
  	file=NULL;
  	return ret;
  	}
  
  ~BGZFSupport()
  	{
 	if(file!=NULL) ::bgzf_close(file);
  	}

   

  static Handle<Value> New(const Arguments& args)
    {
    HandleScope scope;
    if (args.Length() < 2)
     	{
     	RETURN_THROW("Expected two parameters for bgfz");
     	}
    if(!args[0]->IsString())
    	{
    	RETURN_THROW("1st argument is not a string");
    	}
    if(!args[1]->IsString())
    	{
    	RETURN_THROW("2nd argument is not a string");
    	}
    
    v8::String::Utf8Value filename(args[0]);
    v8::String::Utf8Value mode(args[1]);
    BGZF* file= ::bgzf_open(ToCString(filename),ToCString(mode));
    if(file==NULL)
    	{
    	RETURN_THROW("Cannot open \"" << ToCString(filename) << "\"");
    	}
    BGZFSupport* instance = new BGZFSupport(file);
    instance->Wrap(args.This());
    return args.This();
    }

  static Handle<Value> Close(const Arguments& args)
    {
    HandleScope scope;
    BGZFSupport* instance = ObjectWrap::Unwrap<BGZFSupport>(args.This());
    Local<Integer> result = Integer::New(instance->close()); ;
    return scope.Close(result);
    }

 /*
 * bytesRead = fs.read(buffer, offset, length)
 *
 * 1 buffer    instance of Buffer
 * 2 offset    integer. offset to start reading into inside buffer
 * 3 length    integer. length to read
 */
 static Handle<Value> Read(const Arguments& args)
    {
    HandleScope scope;
    
    if (args.Length() < 3)
     	{
     	RETURN_THROW("Expected 3 parameters for read but got "<< args.Length());
     	}
   	
    if (!Buffer::HasInstance(args[0]))
    	{
    	RETURN_THROW("1st argument needs to be a buffer");
  	}
  	
   if (!args[1]->IsInt32())
   	{
   	RETURN_THROW("Second argument needs to be an integer");
   	}
   if (!args[2]->IsInt32())
   	{
   	RETURN_THROW("3rd argument needs to be an integer");
   	}
    Local<Object> buffer = args[0]->ToObject();
    char *buffer_data = Buffer::Data(buffer);
    size_t buffer_length = Buffer::Length(buffer);
    
    
    size_t offset = args[1]->Int32Value();
    if (offset >= buffer_length) RETURN_THROW("Offset is out of bounds");
     
    size_t length = args[2]->Int32Value();
    if (offset + length > buffer_length) RETURN_THROW("Length is extends beyond buffer");
    
    
    BGZFSupport* instance = ObjectWrap::Unwrap<BGZFSupport>(args.This());
    if(instance->file==NULL) RETURN_THROW("bgzf file is closed");
    
    int nRead=bgzf_read(instance->file,(void*)(buffer_data+offset),length);
    
    Local<Integer> result = Integer::New(nRead); ;
    return scope.Close(result);
    }


};

Persistent<FunctionTemplate> BGZFSupport::s_ct;

extern "C" {
  static void init (Handle<Object> target)
  {
    BGZFSupport::Init(target);
  }

  NODE_MODULE(bgzf, init);
}
