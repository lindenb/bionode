#ifndef THROW_H
#define THROW_H

#include <sstream>
#include <iostream>
#include <string>

#define RETURN_THROW(a) \
	do \
	{\
	std::ostringstream _os;\
	_os << __FILE__ << ":[" << __LINE__ << "]:" << a;\
	std::string _s(_os.str());\
	return ThrowException(Exception::TypeError(String::New(_s.data(),_s.length())));\
	} while(false)


#endif

