@echo off
setlocal enabledelayedexpansion
set PATH=C:\Users\Mani\AppData\Local\MinGit\cmd;%PATH%
cd /d "F:\Project\POS"

echo ============================================================
echo      CloudGST Pro - Push Code to GitHub
echo      Repository: https://github.com/mcubecomputers0/POS.git
echo ============================================================
echo.
echo NOTE: GitHub requires a Personal Access Token (PAT) instead of a password.
echo.
echo If you already have a token, paste it below.
echo.
echo If you do NOT have a token yet:
echo   1. Open: https://github.com/settings/tokens
echo   2. Click "Generate new token" -^> "Generate new token (classic)"
echo   3. Set Note to "POS" and CHECK THE "repo" BOX
echo   4. Click "Generate token" at bottom and copy the token (starts with ghp_)
echo ============================================================
echo.

set /p GITHUB_TOKEN="Enter your GitHub Token (or press Enter to try default): "

if "%GITHUB_TOKEN%"=="" (
    echo.
    echo Trying direct push...
    git push -u origin main
) else (
    echo.
    echo Pushing with your token...
    git push -u https://%GITHUB_TOKEN%@github.com/mcubecomputers0/POS.git main
)

if %errorlevel% equ 0 (
    echo.
    echo ============================================================
    echo [SUCCESS] Code pushed successfully to GitHub!
    echo Render will now automatically detect your code and build.
    echo ============================================================
) else (
    echo.
    echo [FAILED] Push failed. Make sure:
    echo  1. The token has 'repo' permissions checked.
    echo  2. The token is copied completely without spaces.
)

echo.
pause
