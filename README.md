# Satzbau B2

Aplicación web para pasar de B1 a B2 en el alemán del trabajo: construir frases, conectores,
rección de verbos y llamadas telefónicas. Funciona sin conexión, se instala como app (PWA) y
no tiene backend ni cuentas.

## Uso

- **Üben**: rondas de 5, 10 o 20 ejercicios, mezclados o por tipo o bloque temático.
  - *Satzbau*: ordenar las partes de la frase. Acepta todos los órdenes válidos listados en el banco.
  - *Konnektoren*: elegir entre cuatro conectores.
  - *Lückentext*: completar la preposición fija u otra palabra clave.
- **Anrufe**: simulación de llamada. El interlocutor habla (texto y voz del dispositivo); tú
  respondes por escrito o en voz alta y comparas con una respuesta modelo. **La app no corrige
  tu respuesta**: tú te autoevalúas (Saß / Fast / Noch nicht).
- **Nachschlagen**: vocabulario, Redemittel por función comunicativa y gramática.
- **Fortschritt**: las métricas medidas (Satzbau, conectores, Lückentext) van separadas de las
  autoevaluadas (llamadas); nunca se mezclan en un mismo porcentaje.
- **Einstellungen**: cantidad de español (Viel / Wenig / Keine), voz, tema, exportar e importar.

El progreso se guarda solo en el navegador del dispositivo. Para pasarlo de un dispositivo a
otro: *Exportieren* en uno e *Importieren und zusammenführen* en el otro.

## Contenido (v1)

Bloques: Anfrage, Termin, Reklamation, Störung, Rechnung.

| Archivo | Contenido |
|---|---|
| `data/saetze-*.json` | 250 frases anotadas → 250 Satzbau, 93 conectores, 73 Lückentext |
| `data/wortschatz.json` | 200 entradas con artículo, plural y ejemplo |
| `data/redemittel.json` | 100 Redemittel en 10 funciones comunicativas |
| `data/grammatik.json` | 12 reglas, explicadas en español |
| `data/anrufe.json` | 8 guiones de llamada (48 turnos propios) |

Las entradas con `"revisar": true` son frases que conviene que confirme un nativo.

### Esquema de una frase

```json
{
  "id": "anf-03",
  "es": "Nos gustaría saber si pueden realizar la revisión en marzo.",
  "chunks": ["wir würden gern wissen,", "ob", "Sie", "die Prüfung", "im März", "durchführen können"],
  "loesungen": ["012345", "012435"],
  "konnektor": { "i": 1, "falsch": ["dass", "wenn", "weil"], "warum": "…" },
  "luecke": { "i": 3, "wort": "an", "lemma": "sich wenden an + Akk" },
  "gram": ["g-indirekt"],
  "revisar": true
}
```

- `loesungen`: todos los órdenes aceptados, como índices de `chunks`. El primero es el orden base.
- `konnektor.i` / `luecke.i`: posición de la parte que se convierte en hueco.
- `ende`: signo final, si no es punto (por ejemplo `"?"`).

## Pruebas

```
python tools/validate.py   # coherencia del banco de datos
python tools/e2e.py        # Chromium vía Playwright: instalable, offline, todos los ejercicios
```

Para probar en local: `python -m http.server` en esta carpeta y abrir `http://localhost:8000`.
