@echo off
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot
set PATH=C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin;C:\Users\Mani\AppData\Local\Android\Sdk\cmdline-tools\latest\bin;%PATH%
set ANDROID_HOME=C:\Users\Mani\AppData\Local\Android\Sdk
set ANDROID_SDK_ROOT=C:\Users\Mani\AppData\Local\Android\Sdk

call npm run cap:sync
cd android
call gradlew.bat assembleDebug
cd ..
copy /y android\app\build\outputs\apk\debug\app-debug.apk release\CloudGST_Pro.apk
