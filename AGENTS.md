# AGENTS.md

## Encender el programa

Cuando el usuario pida encender/entrar/arrancar el programa, usar:

```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\marce\mascalculador\client'; npm run dev"
```

Esto lanza el servidor de desarrollo Vite en una ventana nueva de PowerShell, disponible en `http://localhost:5173/`.
