/* Hand-written replacement for the autoconf-generated config.h, used only for
   the WebAssembly build.

   The native build ran ./configure to probe the host; Emscripten's sysroot is a
   fixed, known target (musl libc), so the probe results are constants and the
   autotools dependency (autopoint/autoconf/automake/gettext/libtool) is not
   needed to build this package.

   Only the macros actually referenced by vendor/tre/lib are listed. Verify with:
     grep -rho 'HAVE_[A-Z0-9_]*' vendor/tre/lib | sort -u
*/

#pragma once

/* --- libc features provided by Emscripten's musl sysroot -------------------
   alloca() is available, but TRE_USE_ALLOCA is deliberately left undefined
   below; HAVE_ALLOCA_H only controls which header regexec.c includes. */
#define HAVE_ALLOCA 1
#define HAVE_ALLOCA_H 1
#define HAVE_ISASCII 1
#define HAVE_ISBLANK 1
#define HAVE_ISWBLANK 1
#define HAVE_ISWCTYPE 1
#define HAVE_MBRTOWC 1
#define HAVE_MBSTATE_T 1
#define HAVE_WCHAR_H 1
#define HAVE_WCHAR_T 1
#define HAVE_WCSRTOMBS 1
#define HAVE_WCTYPE 1
#define HAVE_WCTYPE_H 1
#define HAVE_WINT_T 1

#define HAVE_INTTYPES_H 1
#define HAVE_STDINT_H 1
#define HAVE_STDIO_H 1
#define HAVE_STDLIB_H 1
#define HAVE_STRINGS_H 1
#define HAVE_STRING_H 1
#define HAVE_SYS_STAT_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_UNISTD_H 1
#define STDC_HEADERS 1

/* Intentionally NOT defined:
   HAVE_GETTEXT   - no libintl in the sysroot; TRE falls back to plain strings.
   HAVE_MALLOC_H  - <stdlib.h> is sufficient.
   HAVE_WCSTOMBS  - unused on the wide-character code path.
*/

/* --- TRE feature selection -------------------------------------------------
   Matches the native build: approximate matching on, tre_char_t == wchar_t. */
#define TRE_APPROX 1
#define TRE_WCHAR 1
#define TRE_MULTIBYTE 1
#define TRE_REGEX_T_FIELD value
#define USE_LOCAL_TRE_H 1

/* TRE_USE_ALLOCA is deliberately undefined. TRE allocates per-match scratch
   buffers sized from the compiled TNFA; on wasm the linear stack is a small
   fixed allocation, so a large pattern would silently overflow it. Undefined,
   TRE uses malloc/free for those buffers instead (see regexec.c:147). */
/* #undef TRE_USE_ALLOCA */

#define NDEBUG 1

#define PACKAGE "tre"
#define PACKAGE_NAME "TRE"
#define PACKAGE_STRING "TRE 0.9.0"
#define PACKAGE_TARNAME "tre"
#define PACKAGE_VERSION "0.9.0"
#define TRE_VERSION "0.9.0"
#define TRE_VERSION_1 0
#define TRE_VERSION_2 9
#define TRE_VERSION_3 0
