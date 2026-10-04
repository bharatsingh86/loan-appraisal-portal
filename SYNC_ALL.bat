@echo off
TITLE PNB Loan Appraisal - Universal Master Synchronization
color 0A
echo =======================================================================
echo     PUNJAB NATIONAL BANK - AUTONOMOUS APPRAISAL & CLOUD SYNC
echo     Syncing Google Drive, GitHub, Vercel, Web Portal and Mobile App
echo =======================================================================
echo.
cd /d "%~dp0"
node auto_sync_all.js
echo.
echo =======================================================================
echo     SYNC PROCESS COMPLETE! Press any key to exit.
echo =======================================================================
pause >nul
