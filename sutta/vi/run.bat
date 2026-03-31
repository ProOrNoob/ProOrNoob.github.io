@echo off
setlocal enabledelayedexpansion

for /l %%i in (1,1,152) do (

    set num=%%i

    if %%i LSS 10 (
        set id=mn0%%i
    ) else (
        set id=mn%%i
    )

    (
        echo window.BILARA = window.BILARA ^|^| {};
        echo window.BILARA["!id!"] = window.BILARA["!id!"] ^|^| {};
        echo window.BILARA["!id!"]["vi"] =
        echo window.BILARA["!id!"]["vi"]["!id!:source"] =
        echo  "Dịch từ nguồn Pali https://suttacentral.net/";
    ) > !id!.js

)

echo Done creating 152 files.
pause