@echo off
title Inkwell Blog Server
echo ================================
echo   Inkwell Blog Platform Server
echo ================================
echo.
cd /d "%~dp0backend"
echo Starting server...
echo.
node server.js
echo.
echo Server stopped. Press any key to exit.
pause
