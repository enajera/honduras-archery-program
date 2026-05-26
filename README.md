# 🏹 FEHTARCO App — Ruta Tiro con Arco Honduras

Plataforma web para gestionar el plan de masificación del tiro con arco en Honduras.

## Requisitos
- Node.js instalado (https://nodejs.org)

## Cómo arrancar

1. Abrir una terminal (CMD o PowerShell) en esta carpeta
2. Instalar dependencias (solo la primera vez):
   ```
   npm install
   ```
3. Iniciar el servidor:
   ```
   npm start
   ```
4. Abrir en el navegador:
   - Sitio principal: http://localhost:3000
   - Panel admin:     http://localhost:3000/admin.html

## Estructura del proyecto

```
fehtarco-app/
├── server.js          ← Servidor Express (API + archivos estáticos)
├── package.json
├── data/              ← Datos editables en JSON
│   ├── niveles.json   ← Niveles, distancias, porcentajes
│   ├── sesiones.json  ← Contenido del Curso de Iniciación
│   ├── micro.json     ← Plan MICRO
│   ├── macro.json     ← Plan MACRO
│   ├── reglas.json    ← Reglas y normativas
│   └── documentos.json← Registro de documentos subidos
├── uploads/           ← Archivos subidos (PDFs, etc.)
└── public/            ← Frontend
    ├── index.html     ← Sitio principal
    ├── admin.html     ← Panel de administración
    ├── css/styles.css
    └── js/app.js
```

## Funcionalidades

- **Ver** ruta de progresión, niveles, reglas, documentos, MICRO y MACRO
- **Subir documentos** (PDF, DOCX, XLSX, imágenes)
- **Editar** todos los datos desde el panel admin sin tocar código
- **Abrir PDFs** directamente desde el navegador
