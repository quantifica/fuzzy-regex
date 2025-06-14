{
    "targets": [
        {
            "target_name": "tre",
            "sources": [
                "../vendor/tre/lib/.libs/tre-match-approx.o",
                "../vendor/tre/lib/.libs/tre-match-backtrack.o",
                "../vendor/tre/lib/.libs/tre-match-parallel.o",
                "../vendor/tre/lib/.libs/tre-mem.o",
                "../vendor/tre/lib/.libs/tre-parse.o",
                "../vendor/tre/lib/.libs/tre-stack.o",
                "../vendor/tre/lib/.libs/tre-ast.o",
                "../vendor/tre/lib/.libs/tre-compile.o",
                "../vendor/tre/lib/.libs/regcomp.o",
                "../vendor/tre/lib/.libs/regexec.o",
                "../vendor/tre/lib/.libs/regerror.o",
                "bindings/tre.cc",
            ],
            "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
            "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "xcode_settings": {
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "CLANG_CXX_LIBRARY": "libc++",
                "MACOSX_DEPLOYMENT_TARGET": "15",
            },
        }
    ]
}
