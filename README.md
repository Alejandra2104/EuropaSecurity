# EuropaSecurity

Mapa interactivo de **avisos de bomba en Europa**. Cada marcador muestra la localización exacta, la localidad, la fecha y hora, el estado del aviso y un enlace a la **fuente oficial** (policía, ministerio del Interior u organismo público competente).

> **Aviso importante:** el repositorio se publica inicialmente en **modo demo** con avisos ficticios. No son noticias reales. Antes de difundir la web, sustituye los datos de `data/incidents.json` por avisos verificados con fuente oficial.

- Web: https://alejandra2104.github.io/EuropaSecurity/
- Repositorio: https://github.com/Alejandra2104/EuropaSecurity

## Funcionalidades

- Mapa de Europa con Leaflet + OpenStreetMap y agrupación de marcadores.
- Iconos según el tipo de lugar: aeropuerto, estación de tren, cuartel/comisaría, edificio gubernamental, embajada, centro educativo, centro comercial u otros.
- Ficha por aviso con localidad, lugar, fecha y hora, estado, resumen y enlace a la fuente oficial.
- Filtros por país, tipo de lugar, estado y periodo (últimos 30/90/180 días, último año o todo).
- Buscador por localidad, lugar, país o resumen.
- Catálogo de portales oficiales por país en el apartado «Metodología».
- Diseño responsive y despliegue automático en GitHub Pages.

## Estructura

```
.
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  ├─ js/app.js
│  └─ favicon.svg
├─ data/
│  ├─ incidents.json   # avisos (único archivo que hay que editar para publicar datos reales)
│  └─ sources.json     # catálogo de fuentes oficiales por país
└─ .github/workflows/pages.yml
```

## Leer y añadir avisos

Cada aviso de `data/incidents.json` sigue este esquema:

```json
{
  "id": "es-2026-11-09-madrid-barajas",
  "country": "ES",
  "country_name": "España",
  "locality": "Madrid",
  "place": "Aeropuerto Adolfo Suárez Madrid-Barajas, Terminal 4",
  "lat": 40.4917,
  "lon": -3.5936,
  "category": "airport",
  "datetime": "2026-11-09T08:15:00+01:00",
  "status": "evacuated",
  "summary": "Llamada anónima alertando de una mochila sospechosa. Se evacuó la terminal.",
  "verified": true,
  "demo": false,
  "source": {
    "name": "Policía Nacional — Sala de prensa",
    "url": "https://www.policia.es/...",
    "type": "official"
  }
}
```

### Campos

| Campo | Obligatorio | Descripción |
| --- | --- | --- |
| `id` | Sí | Identificador único y estable. |
| `country` | Sí | Código ISO 3166-1 alpha-2 (`ES`, `FR`, `DE`…). |
| `country_name` | Sí | Nombre del país en español. |
| `locality` | Sí | Localidad. |
| `place` | Sí | Lugar exacto (terminal, estación, cuartel…). |
| `lat`, `lon` | Sí | Coordenadas WGS84 en grados decimales. |
| `category` | Sí | `airport`, `train`, `police`, `government`, `embassy`, `education`, `shopping` u `other`. |
| `datetime` | Sí | ISO 8601 con zona horaria (`2026-11-09T08:15:00+01:00`). |
| `status` | Sí | `investigating`, `evacuated`, `hoax`, `confirmed` o `cleared`. |
| `summary` | Sí | Resumen breve y neutral, sin detalles operativos. |
| `verified` | No | `true` cuando el aviso ha sido contrastado con la fuente oficial. |
| `demo` | No | `true` para ejemplos ficticios; se muestra una etiqueta. |
| `source.name` | Sí | Nombre del organismo oficial. |
| `source.url` | Sí | Enlace **https** a la publicación oficial concreta. |
| `source.type` | Sí | `official` para fuentes públicas competentes. |

Estados:

- `investigating`: aviso en investigación.
- `evacuated`: evacuación preventiva en curso.
- `hoax`: falsa alarma.
- `confirmed`: artefacto confirmado (desactivado o detonado de forma controlada).
- `cleared`: comprobado sin riesgo / servicio normalizado.

Tipos de lugar e iconos:

| `category` | Icono |
| --- | --- |
| `airport` | Avión |
| `train` | Tren |
| `police` | Escudo policial |
| `government` | Edificio institucional |
| `embassy` | Bandera |
| `education` | Escuela |
| `shopping` | Carrito |
| `other` | Triángulo de advertencia |

### Reglas de las fuentes

- Solo se admite **fuente oficial**: policía, ministerio del Interior, protección civil, gobierno u organismo público competente.
- **No** se admiten periódicos, tabloides, agregadores, redes sociales ni filtraciones.
- Enlaza la publicación oficial concreta, no la portada del medio.
- Si no existe publicación oficial, el aviso no debe publicarse.
- Revisa el enlace antes de hacer commit: las URLs oficiales cambian con frecuencia.
- Etiqueta siempre las falsas alarmas como `hoax` y los ejemplos como `demo`.

Los avisos de amenaza de bomba son información sensible: **no publiques detalles operativos** (sistemas de seguridad, puntos de acceso, tiempos de respuesta) ni datos personales.

## Desarrollo local

El navegador bloquea `fetch()` de archivos locales, así que sirve el proyecto con un servidor estático:

```bash
python -m http.server 8000
# o, con Node.js:
npx serve .
```

Abre http://localhost:8000 (o la URL que indique `serve`).

También puedes usar la extensión Live Server de VS Code.

## Despliegue en GitHub Pages

El workflow `.github/workflows/pages.yml` despliega automáticamente cada push a `main`:

1. Hace checkout del repositorio.
2. Configura Pages (lo habilita si aún no existe).
3. Sube el sitio como artefacto.
4. Publica en GitHub Pages.

La primera ejecución puede tardar un par de minutos. El resultado aparece en la pestaña **Actions** y en https://alejandra2104.github.io/EuropaSecurity/.

## Actualización de datos

Ahora mismo la actualización es **manual y revisada**:

1. Localiza una publicación oficial.
2. Añade el aviso a `data/incidents.json` con coordenadas y enlace.
3. Haz commit y push a `main`.
4. Pages se actualiza solo.

### Sobre las APIs en tiempo real

No existe una API pública paneuropea de amenazas de bomba. Los ministerios de Interior no publican estos avisos de forma estructurada ni en tiempo real por motivos operativos y de protección de datos. Por eso el proyecto usa un **dataset curado**.

Siguiente paso recomendado (semi-automatización, con revisión humana):

- Un GitHub Action que consulte los RSS/notas de prensa oficiales de `data/sources.json`.
- Si detecta una posible amenaza, abre un **issue** o un **pull request** con el borrador.
- Una persona verifica la fuente y el aviso antes de publicarlo.

Así se evita el scraping agresivo, los bulos y las notificaciones falsas.

## Limitaciones y aviso legal

- El mapa está **incompleto por diseño**: muchos avisos no se hacen públicos, se retiran o no se confirman.
- No es un servicio de alerta ni de emergencia. Ante cualquier amenaza, llama al **112** o al servicio de emergencias local.
- La información mostrada no sustituye a las comunicaciones oficiales.
- Los datos de demostración son ficticios y están etiquetados como tales.
