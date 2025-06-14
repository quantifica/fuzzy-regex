#pragma once

#define HAVE_CONFIG_H 1
#define USE_LOCAL_TRE_H 1

#include "../vendor/tre/local_includes/regex.h"
#include <napi.h>

class Tre : public Napi::ObjectWrap<Tre>
{
public:
  Tre(const Napi::CallbackInfo &);
  Napi::Value Fuzzy(const Napi::CallbackInfo &);
  Napi::Value FuzzyExec(const Napi::CallbackInfo &);

  static Napi::Function GetClass(Napi::Env);

private:
  regex_t compiled;
};
