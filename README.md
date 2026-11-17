# EuropaSecurity

Mapa interactivo de **avisos de bomba en Europa**. Cada marcador muestra la localización exacta, la localidad, la fecha y hora, el estado del aviso y las fuentes disponibles: **notas de policía, comunicados oficiales y notas de prensa**.

Los avisos se contrastan con publicaciones policiales, oficiales y de prensa, y se revisan manualmente antes de publicarse. La cobertura es limitada y depende de que exista información pública enlazable. Cada ficha indica el resultado del aviso (falsa alarma, descartado, real o pendiente) y diferencia claramente las falsas alarmas de los casos con explosivos confirmados.

- Web: https://alejandra2104.github.io/EuropaSecurity/
- Repositorio: https://github.com/Alejandra2104/EuropaSecurity

## Funcionalidades

- Mapa de Europa con Leaflet + OpenStreetMap y agrupación de marcadores.
- Iconos según el tipo de lugar: aeropuerto, estación de tren, cuartel/comisaría, edificio gubernamental, embajada, centro educativo, centro comercial u otros.
- Ficha por aviso con localidad, lugar, fecha y hora, estado, resultado, resumen y fuentes (policía, oficiales y prensa).
- Panel de balance con porcentaje de falsas alarmas frente a casos reales; los pendientes se muestran aparte.
- Filtros por país, tipo de lugar, estado, resultado, fuente y periodo (últimos 30/90/180 días, último año o todo).
- Buscador por localidad, lugar, país o resumen.
- Modal de análisis con perfil provisional de la autoría, hipótesis, indicadores, casos conocidos y fuentes.
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
│  ├─ incidents.json   # avisos, resultados y fuentes
│  ├─ analysis.json    # perfil provisional, hipótesis y fuentes del análisis
│  └─ sources.json     # catálogo de fuentes oficiales por país
└─ .github/workflows/pages.yml
```

## Leer y añadir avisos

Cada aviso de `data/incidents.json` sigue este esquema:

```json
{
  "id": "es-2026-11-12-zaragoza-delicias",
  "country": "ES",
  "country_name": "España",
  "locality": "Zaragoza",
  "place": "Estación de Zaragoza-Delicias",
  "lat": 41.6586,
  "lon": -0.9116,
  "category": "train",
  "datetime": "2026-11-12T14:00:00+01:00",
  "time_precision": "approximate",
  "status": "hoax",
  "summary": "Una llamada anónima alertó de una mochila sospechosa. Se restringieron los accesos y un tren se detuvo en Calatayud; la inspección no halló explosivos. La Policía detuvo después a un hombre que, según la investigación, hizo la llamada porque llegaba tarde a su tren.",
  "verified": true,
  "demo": false,
  "source": {
    "name": "ElDiario.es — Aragón",
    "url": "https://www.eldiario.es/aragon/sociedad/detenido-hombre-invento-amenaza-bomba-estacion-zaragoza-llegaba-tarde-tren_1_13667565.html",
    "type": "press"
  },
  "sources": [
    {
      "name": "Policía Nacional — comunicado citado por Diario Vasco",
      "url": "https://www.diariovasco.com/sociedad/detenido-navarra-simular-amenaza-bomba-perder-ave-20261116160346-nt.html",
      "type": "official_statement",
      "date": "2026-11-16",
      "note": "Detención en Tudela y recomendaciones ante objetos sospechosos."
    },
    {
      "name": "ElDiario.es — Aragón",
      "url": "https://www.eldiario.es/aragon/sociedad/detenido-hombre-invento-amenaza-bomba-estacion-zaragoza-llegaba-tarde-tren_1_13667565.html",
      "type": "press",
      "date": "2026-11-16",
      "note": "Detención por un presunto delito de desórdenes públicos."
    }
  ]
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
| `datetime` | Sí | ISO 8601 con zona horaria (`2026-10-05T16:30:00+02:00`). |
| `time_precision` | No | `exact`, `approximate` o `day`. Si falta, se asume `exact`. |
| `status` | Sí | `investigating`, `evacuated`, `hoax`, `confirmed` o `cleared`. |
| `summary` | Sí | Resumen breve y neutral, sin detalles operativos. |
| `verified` | No | `true` cuando el aviso ha sido contrastado con las fuentes enlazadas y revisado editorialmente. No implica confirmación oficial si solo hay prensa. |
| `demo` | No | `true` para ejemplos ficticios; se muestra una etiqueta. |
| `source` | Sí | Fuente principal. Se mantiene por compatibilidad. |
| `sources` | Recomendado | Lista de fuentes del aviso. Si existe, `source` debe ser la primera. |
| `sources[].name` | Sí | Nombre del medio u organismo y, si procede, el tipo de documento. |
| `sources[].url` | Sí | Enlace **https** a la publicación concreta. |
| `sources[].type` | Sí | `police`, `official`, `official_statement` o `press`. |
| `sources[].date` | No | Fecha de publicación (`YYYY-MM-DD`). |
| `sources[].note` | No | Qué aporta esa fuente (detención, parte oficial, contexto…). |

### Tipos de fuente

- `police`: nota o comunicado de policía, gendarmería o guardia civil.
- `official`: fuente pública competente (gobierno, ministerio, autoridad aeroportuaria…).
- `official_statement`: declaraciones oficiales recogidas por un medio.
- `press`: nota de prensa o reportaje contrastado.

Estados y resultado:

| `status` | Resultado en la web | Significado |
| --- | --- | --- |
| `hoax` | Falsa alarma | Amenaza declarada falsa por la fuente. |
| `cleared` | Descartada | Inspección finalizada sin riesgo ni explosivos. |
| `confirmed` | Real confirmada | Artefacto explosivo real confirmado. |
| `investigating` | Pendiente | Aviso en investigación o sin resultado publicado. |
| `evacuated` | Pendiente | Evacuación preventiva en curso o sin confirmación posterior. |

Porcentajes: el balance calcula el porcentaje de falsas alarmas y de casos reales **sobre los avisos resueltos** (`hoax` + `cleared` + `confirmed`). Los avisos `investigating` y `evacuated` se muestran aparte para no inflar artificialmente ninguno de los dos lados.

Precisión de la fecha y hora:

- `exact`: la fuente indica la hora del suceso.
- `approximate`: la fuente indica una hora aproximada («hacia las 16:30»); la ficha lo señala como «hora aproximada».
- `day`: la fuente solo indica el día; el mapa muestra la fecha sin inventar una hora.

El filtro de periodo se aplica por días. Por defecto se muestran los últimos seis meses; selecciona «Todo» para ver los avisos anteriores.

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

- Prioriza **policía, ministerio del Interior, protección civil, gobierno u organismo público competente**.
- Las notas de prensa se admiten como fuente complementaria y, cuando no exista publicación oficial, como fuente principal claramente etiquetada como `press`.
- **No** se admiten tabloides, agregadores, redes sociales ni filtraciones.
- Enlaza la publicación concreta, no la portada del medio.
- Si solo hay prensa, no presentes el aviso como confirmado oficialmente: indícalo en la ficha y en la nota de la fuente.
- Revisa el enlace antes de hacer commit: las URLs cambian con frecuencia.
- Etiqueta siempre las falsas alarmas como `hoax` cuando la fuente lo indique.
- No inventes la hora: si la nota solo da el día, usa `time_precision: "day"`.

Los avisos de amenaza de bomba son información sensible: **no publiques detalles operativos** (sistemas de seguridad, puntos de acceso, tiempos de respuesta) ni datos personales de detenidos, sospechosos o víctimas.

## Análisis y perfil

`data/analysis.json` contiene el análisis editorial de la oleada y el perfil provisional de la autoría. Se muestra en el modal «Análisis» y alimenta los apartados de hipótesis, indicadores, casos conocidos y casos reales.

- El perfil se basa en fuentes abiertas y es **provisional**.
- El análisis y sus porcentajes usan el conjunto completo de avisos; los filtros del mapa no alteran esas cifras.
- No atribuye delitos a personas concretas ni sustituye a la investigación policial.
- No incluye nombres, alias ni datos identificativos de detenidos o sospechosos.
- Las etiquetas de confianza (`confirmado`, `indicios`, `hipotesis`, `separado`) son una valoración editorial, no una calificación policial.
- Los porcentajes del análisis se calculan sobre los avisos resueltos y cambian al actualizar `incidents.json`.

Estructura mínima:

```json
{
  "meta": { "disclaimer": "..." },
  "headline": "...",
  "false_alarm_profile": {
    "summary": "...",
    "patterns": [{ "title": "...", "text": "..." }],
    "hypotheses": [{ "title": "...", "text": "...", "confidence": "indicios" }],
    "indicators": ["..."],
    "known_cases": [{ "date": "...", "place": "...", "profile": "...", "method": "...", "motive": "...", "outcome": "...", "source": "https://..." }],
    "known_cases_note": "..."
  },
  "real_attack_profile": {
    "title": "...",
    "summary": "...",
    "facts": ["..."],
    "differences": ["..."],
    "warning": "..."
  },
  "sources": [{ "name": "...", "url": "https://...", "type": "press", "date": "...", "note": "..." }]
}
```

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

1. Localiza publicaciones policiales, oficiales y de prensa sobre el aviso.
2. Añade o actualiza el aviso en `data/incidents.json` con coordenadas, fuentes y resultado.
3. Revisa el perfil y las fuentes de `data/analysis.json` si el caso cambia el análisis.
4. Haz commit y push a `main`.
5. Pages se actualiza solo.

### Sobre las APIs en tiempo real

No existe una API pública paneuropea de amenazas de bomba. Los ministerios de Interior no publican estos avisos de forma estructurada ni en tiempo real por motivos operativos y de protección de datos. Por eso el proyecto usa un **dataset curado** con fuentes policiales, oficiales y de prensa.

Siguiente paso recomendado (semi-automatización, con revisión humana):

- Un GitHub Action que consulte los RSS/notas de prensa oficiales de `data/sources.json`.
- Si detecta una posible amenaza, abre un **issue** o un **pull request** con el borrador.
- Una persona verifica la fuente y el aviso antes de publicarlo.

Así se evita el scraping agresivo, los bulos y las notificaciones falsas.

## Limitaciones y aviso legal

- El mapa está **incompleto por diseño**: muchos avisos no se hacen públicos, se retiran o no se confirman.
- La cobertura depende de que exista información pública enlazable. Algunos países publican muy poco o nada sobre estos incidentes.
- Algunos avisos solo cuentan con cobertura de prensa; se etiquetan como tales y no deben interpretarse como confirmación oficial.
- Los porcentajes se calculan sobre casos resueltos y pueden cambiar cuando se publican nuevos datos.
- El perfil incluido en el análisis es **provisional** y no atribuye delitos a personas concretas.
- Algunas notas no indican la hora exacta; en esos casos la ficha lo aclara y no se inventa una hora.
- No es un servicio de alerta ni de emergencia. Ante cualquier amenaza, llama al **112** o al servicio de emergencias local.
- La información mostrada no sustituye a las comunicaciones oficiales.
