@echo off
set PATH=C:\Users\Mani\AppData\Local\MinGit\cmd;%PATH%
echo ============================================================
echo   CloudGST Pro - Pushing Code to GitHub
echo   Repository: https://github.com/mcubecomputers0/POS.git
echo ============================================================
echo.

git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo ------------------------------------------------------------
    echo If prompted for a password, enter your GitHub Personal Access Token (PAT).
    echo Generate a token at: https://github.com/settings/tokens (select 'repo' scope)
    echo ------------------------------------------------------------
)
pause
