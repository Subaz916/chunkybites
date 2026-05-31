@echo off
title CHUNKY BITES Server
color 0A
echo.
echo  ==========================================
echo    CHUNKY BITES - Starting Backend Server
echo  ==========================================
echo.
echo  Installing dependencies...
pip install flask flask-cors -q
echo.
echo  Starting server on http://localhost:5000
echo  Admin: admin@chunky.com / admin123
echo  Press CTRL+C to stop.
echo.
python server.py
pause
