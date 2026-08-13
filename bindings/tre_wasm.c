/* Flat C ABI over TRE's wide-character approximate matching, exported to
   WebAssembly. Replaces the Node-only N-API addon that used to live in tre.cc.

   Strings cross the boundary as UTF-32 (wchar_t is 4 bytes under Emscripten),
   not UTF-8. The byte-oriented entry points (regncomp/reganexec) decode via
   mbrtowc, which depends on MB_CUR_MAX; Emscripten's default locale reports
   MB_CUR_MAX == 1, so those would mangle every non-ASCII character. The wide
   entry points take code points directly and rely only on iswctype/towlower,
   which are locale-independent here. That also makes an "error" one code point
   rather than one UTF-8 byte, so an accented character counts as a single
   substitution.

   Single-threaded by construction: the module is instantiated per JS thread and
   wasm has no preemption, so the file-static error state below cannot race. */

/* Must precede regex.h: USE_LOCAL_TRE_H, defined there, is what makes regex.h
   resolve to vendor/tre/local_includes/tre.h rather than an installed <tre/tre.h>. */
#ifdef HAVE_CONFIG_H
#include <config.h>
#endif

#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#include "regex.h"

/* Returned by fr_exec when the loader passed something impossible. TRE's own
   reg_errcode_t values are 1..14 and are returned negated, so this sits well
   clear of them. Kept in sync with FR_EINVAL in src/wasm.ts. */
#define FR_EINVAL (-1000)

/* Kept in sync with FR_PARAM_* in src/wasm.ts. */
enum {
  FR_PARAM_COST_INS = 0,
  FR_PARAM_COST_DEL,
  FR_PARAM_COST_SUBST,
  FR_PARAM_MAX_COST,
  FR_PARAM_MAX_INS,
  FR_PARAM_MAX_DEL,
  FR_PARAM_MAX_SUBST,
  FR_PARAM_MAX_ERR,
  FR_PARAM_COUNT
};

/* Error state from the most recent fr_compile failure. regerror() needs the
   regex_t that failed, which is freed before fr_compile returns, so the message
   is rendered eagerly and cached here. */
static int fr_error_code = 0;
static char fr_error_buf[256];

/* Compiles `pattern`, a run of `len` code points. Returns an opaque non-zero
   handle on success, or 0 on failure with the reason available from
   fr_last_error_code()/fr_last_error_message(). */
regex_t *fr_compile(const wchar_t *pattern, int len, int case_insensitive) {
  regex_t *preg;
  int cflags, err;

  fr_error_code = 0;
  fr_error_buf[0] = '\0';

  if (len < 0) {
    fr_error_code = REG_BADPAT;
    strcpy(fr_error_buf, "Pattern length must not be negative");
    return NULL;
  }

  preg = calloc(1, sizeof(*preg));
  if (preg == NULL) {
    fr_error_code = REG_ESPACE;
    strcpy(fr_error_buf, "Out of memory");
    return NULL;
  }

  cflags = REG_EXTENDED;
  if (case_insensitive) {
    cflags |= REG_ICASE;
  }

  err = regwncomp(preg, pattern, (size_t)len, cflags);
  if (err != 0) {
    fr_error_code = err;
    /* Render now, while preg is still valid. */
    regerror(err, preg, fr_error_buf, sizeof(fr_error_buf));
    regfree(preg);
    free(preg);
    return NULL;
  }

  return preg;
}

void fr_free(regex_t *preg) {
  if (preg == NULL) {
    return;
  }
  regfree(preg);
  free(preg);
}

int fr_last_error_code(void) { return fr_error_code; }

const char *fr_last_error_message(void) { return fr_error_buf; }

/* Number of capture groups in the compiled pattern. */
int fr_nsub(const regex_t *preg) {
  return preg == NULL ? 0 : (int)preg->re_nsub;
}

/* Runs approximate matching over `str` (`len` code points).

   `params` points at FR_PARAM_COUNT ints in the order of the FR_PARAM_* enum.
   On a match, 2 * nmatch ints are written to `out_offsets` as (start, end)
   code-point pairs per group, -1 for a group that did not participate.

   Returns 1 on a match, 0 on no match, and a negative TRE error code on
   failure. Pass nmatch == 0 with out_offsets == NULL for a boolean test, which
   lets TRE skip submatch tracking entirely. */
int fr_exec(const regex_t *preg, const wchar_t *str, int len, const int *params,
            int *out_offsets, int nmatch) {
  regamatch_t match;
  regaparams_t aparams;
  regmatch_t *pmatch = NULL;
  int err, i;

  if (preg == NULL || params == NULL || len < 0 || nmatch < 0) {
    return FR_EINVAL;
  }

  if (nmatch > 0) {
    if (out_offsets == NULL) {
      return FR_EINVAL;
    }
    pmatch = calloc((size_t)nmatch, sizeof(*pmatch));
    if (pmatch == NULL) {
      return -REG_ESPACE;
    }
  }

  memset(&match, 0, sizeof(match));
  match.nmatch = (size_t)nmatch;
  match.pmatch = pmatch;

  aparams.cost_ins = params[FR_PARAM_COST_INS];
  aparams.cost_del = params[FR_PARAM_COST_DEL];
  aparams.cost_subst = params[FR_PARAM_COST_SUBST];
  aparams.max_cost = params[FR_PARAM_MAX_COST];
  aparams.max_ins = params[FR_PARAM_MAX_INS];
  aparams.max_del = params[FR_PARAM_MAX_DEL];
  aparams.max_subst = params[FR_PARAM_MAX_SUBST];
  aparams.max_err = params[FR_PARAM_MAX_ERR];

  err = regawnexec(preg, str, (size_t)len, &match, aparams, 0);

  if (err != 0) {
    free(pmatch);
    /* REG_NOMATCH is an ordinary "no match", anything else is a real failure. */
    return err == REG_NOMATCH ? 0 : -err;
  }

  for (i = 0; i < nmatch; i++) {
    out_offsets[2 * i] = (int)pmatch[i].rm_so;
    out_offsets[2 * i + 1] = (int)pmatch[i].rm_eo;
  }

  free(pmatch);
  return 1;
}
