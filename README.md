# 🎮 Forja de Skins — Editor de skins de Minecraft

Editor y generador de skins de Minecraft que corre 100% en el navegador, con
previsualización 3D en vivo del personaje. Pintás sobre el mapa 64×64, ves el
modelo girar y caminar al instante, y descargás el PNG listo para subir al juego.

**Sin frameworks, sin build, sin backend.** HTML + CSS + JavaScript puro.
La vista 3D usa [Three.js](https://threejs.org/) cargado desde CDN.

## ✨ Qué hace

- **Editor de píxeles** con lápiz, balde, gotero, goma y herramienta de **sombra** (oscurece, o aclara con Shift).
- **Vista 3D en vivo** que se actualiza mientras pintás. Gira sola, se arrastra a mano y tiene modo **caminar**.
- **Zoom y desplazamiento** del lienzo (rueda + barra espaciadora) para los detalles finos.
- **Simetría** dentro de cada cara y botón **Reflejar lados** (copia brazo/pierna derechos al izquierdo).
- **Plantillas** para arrancar: Steve, Alex, aleatorio o vacío.
- **Importar** un PNG existente y **exportar** en 64×64.
- Deshacer / rehacer, paleta rápida y atajos de teclado.

## 📁 Estructura

```
.
├── index.html        # estructura de la página
├── css/
│   └── styles.css    # estilos (estética Minecraft)
└── js/
    └── app.js        # toda la lógica: editor 2D + render 3D
```

## 🚀 Deploy en Vercel

Es un sitio estático, así que **no hace falta configurar nada**.

**Opción A — desde la web (lo más fácil):**
1. Entrá a [vercel.com](https://vercel.com) y hacé *Add New → Project*.
2. Importá este repo (`generador-de-skins`).
3. Dejá todo por defecto (Framework Preset: *Other*) y dale *Deploy*.

Cada vez que hagas `push` a la rama principal, Vercel redeploya solo.

**Opción B — desde la terminal:**
```bash
npm i -g vercel
vercel        # primera vez, seguí los pasos
vercel --prod # para publicar a producción
```

## 💻 Probar en local

No necesita servidor: abrí `index.html` directo en el navegador.
Si querés levantarlo con un servidor local:

```bash
npx serve .
# o
python3 -m http.server
```

## 📝 Licencia

MIT — usalo y modificalo libremente.
