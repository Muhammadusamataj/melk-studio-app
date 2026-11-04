#!/bin/sh
# Compile-checks the app's native Java against a REAL android.jar and runs the JUnit tests.
# This is NOT a Gradle build: Capacitor and AndroidX are replaced by small stubs (tools/android-compile-check/stubs).
# The stubs copy the signatures from @capacitor/android 8.5.3, so they catch wrong Android API calls and type errors,
# but they cannot catch Gradle, resource, manifest-merge or R8 problems. Always also run the real build:
#     cd android && ./gradlew assembleDebug testDebugUnitTest
#
# Usage: ANDROID_JAR=/path/to/android-36/android.jar sh tools/android-compile-check/check-native.sh
# JUnit 4 and Hamcrest jars are found in /usr/share/java (Debian/Ubuntu: apt install junit4 libhamcrest-java) or JUNIT_JAR / HAMCREST_JAR.
set -e
: "${ANDROID_JAR:?set ANDROID_JAR to an android.jar (API 36 matches compileSdk)}"
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT=$(mktemp -d)
JUNIT=${JUNIT_JAR:-/usr/share/java/junit4.jar}
HAM=${HAMCREST_JAR:-/usr/share/java/hamcrest-core.jar}
SRC="$ROOT/android/app/src/main/java"
echo "== compile main sources against $(basename "$ANDROID_JAR") + stubs"
find "$SRC" "$HERE/stubs" -name '*.java' > "$OUT/main.txt"
javac -Xlint:all,-deprecation -proc:none -d "$OUT/main" -cp "$ANDROID_JAR" @"$OUT/main.txt"
echo "   OK ($(wc -l < "$OUT/main.txt") files)"
echo "== compile and run unit tests"
find "$ROOT/android/app/src/test/java" -name '*.java' > "$OUT/test.txt"
javac -Xlint:all -d "$OUT/test" -cp "$OUT/main:$JUNIT:$HAM" @"$OUT/test.txt"
CLASSES=$(cd "$ROOT/android/app/src/test/java" && find . -name '*Test.java' | sed 's|^\./||; s|\.java$||; s|/|.|g' | tr '\n' ' ')
java -cp "$OUT/test:$OUT/main:$JUNIT:$HAM" org.junit.runner.JUnitCore $CLASSES
rm -rf "$OUT"
