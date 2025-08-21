#include "tre.h"

using namespace Napi;

Tre::Tre(const Napi::CallbackInfo &info)
    : ObjectWrap(info)
{
  Napi::Env env = info.Env();

  int length = info.Length();

  if (length < 1 || !info[0].IsString())
  {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return;
  }

  std::string regexp = info[0].ToString();
  bool caseInsensitive = false;

  if (length > 1 && info[1].IsBoolean())
  {
    caseInsensitive = info[1].ToBoolean();
  }

  int cflags = REG_EXTENDED;
  if (caseInsensitive)
  {
    cflags |= REG_ICASE;
  }
  int err = regncomp(&compiled, regexp.data(), regexp.length(), cflags);
  if (err != 0)
  {
    Napi::Error::New(env, std::string("Failed to compile regexp '").append(regexp).append("' '").append(std::to_string(err)).append("'")).ThrowAsJavaScriptException();
  }
}

Napi::Value Tre::Fuzzy(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  int length = info.Length();

  if (length < 1 || !info[0].IsString())
  {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string str = info[0].ToString();

  int cost_ins = 1;
  int cost_del = 1;
  int cost_subst = 1;
  int max_cost = 0;
  int max_ins = 0;
  int max_del = 0;
  int max_subst = 0;
  int max_err = 0;

  if (length > 1 && info[1].IsObject())
  {
    Napi::Object options = info[1].As<Napi::Object>();
    cost_ins = options.Get("costIns").ToNumber().Int32Value();
    cost_del = options.Get("costDel").ToNumber().Int32Value();
    cost_subst = options.Get("costSubst").ToNumber().Int32Value();
    max_cost = options.Get("maxCost").ToNumber().Int32Value();
    max_ins = options.Get("maxIns").ToNumber().Int32Value();
    max_del = options.Get("maxDel").ToNumber().Int32Value();
    max_subst = options.Get("maxSubst").ToNumber().Int32Value();
    max_err = options.Get("maxErr").ToNumber().Int32Value();
  } else {
    Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  regamatch_t match;
  match.nmatch = 0;
  match.pmatch = nullptr;
  regaparams_t params;
  params.cost_ins = cost_ins;
  params.cost_del = cost_del;
  params.cost_subst = cost_subst;
  params.max_cost = max_cost;
  params.max_ins = max_ins;
  params.max_del = max_del;
  params.max_subst = max_subst;
  params.max_err = max_err;
  int eflags = 0;
  int err = reganexec(&compiled, str.data(), str.length(), &match, params, eflags);
  return Napi::Boolean::New(env, err == 0);
}

Napi::Value Tre::FuzzyExec(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  int length = info.Length();

  if (length < 1 || !info[0].IsString())
  {
    Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
    return env.Null();
  }
  std::string str = info[0].ToString();

  int cost_ins = 1;
  int cost_del = 1;
  int cost_subst = 1;
  int max_cost = 0;
  int max_ins = 0;
  int max_del = 0;
  int max_subst = 0;
  int max_err = 0;

  if (length > 1 && info[1].IsObject())
  {
    Napi::Object options = info[1].As<Napi::Object>();
    cost_ins = options.Get("costIns").ToNumber().Int32Value();
    cost_del = options.Get("costDel").ToNumber().Int32Value();
    cost_subst = options.Get("costSubst").ToNumber().Int32Value();
    max_cost = options.Get("maxCost").ToNumber().Int32Value();
    max_ins = options.Get("maxIns").ToNumber().Int32Value();
    max_del = options.Get("maxDel").ToNumber().Int32Value();
    max_subst = options.Get("maxSubst").ToNumber().Int32Value();
    max_err = options.Get("maxErr").ToNumber().Int32Value();
  } else {
    Napi::TypeError::New(env, "Options object expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  regamatch_t match;
  match.nmatch = compiled.re_nsub + 1;
  match.pmatch = new regmatch_t[match.nmatch];
  regaparams_t params;
  params.cost_ins = cost_ins;
  params.cost_del = cost_del;
  params.cost_subst = cost_subst;
  params.max_cost = max_cost;
  params.max_ins = max_ins;
  params.max_del = max_del;
  params.max_subst = max_subst;
  params.max_err = max_err;
  int eflags = 0;
  int err = reganexec(&compiled, str.data(), str.length(), &match, params, eflags);
  if (err != 0)
  {
    return env.Null();
  }
  Napi::Array result = Napi::Array::New(env, match.nmatch);
  for (size_t i = 0; i < match.nmatch; i++)
  {
    result.Set(uint32_t(i), Napi::String::New(env, str.substr(match.pmatch[i].rm_so, match.pmatch[i].rm_eo - match.pmatch[i].rm_so)));
  }
  delete[] match.pmatch;
  return result;
}

Napi::Function Tre::GetClass(Napi::Env env)
{
  return DefineClass(
      env,
      "Tre",
      {
          Tre::InstanceMethod("fuzzy", &Tre::Fuzzy),
          Tre::InstanceMethod("fuzzyExec", &Tre::FuzzyExec),
      });
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  Napi::String name = Napi::String::New(env, "Tre");
  exports.Set(name, Tre::GetClass(env));
  return exports;
}

NODE_API_MODULE(addon, Init)
