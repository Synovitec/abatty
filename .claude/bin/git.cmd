@echo off
rem The Windows twin of the shim beside it: the same refusals, out of the same file. cmd has no
rem exec, so the exit code is carried back by hand rather than inherited.
node "%~dp0shim.mjs" %*
exit /b %errorlevel%
