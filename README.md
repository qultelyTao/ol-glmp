# ol-glmp

A library for rendering massive data based on openlayer


## Browser Support

![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png) | ![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png) | ![Safari](https://raw.github.com/alrra/browser-logos/master/src/safari/safari_48x48.png) | ![Opera](https://raw.github.com/alrra/browser-logos/master/src/opera/opera_48x48.png) | ![Edge](https://raw.github.com/alrra/browser-logos/master/src/edge/edge_48x48.png) | ![IE](https://raw.github.com/alrra/browser-logos/master/src/archive/internet-explorer_9-11/internet-explorer_9-11_48x48.png) |
--- | --- | --- | --- | --- | --- |
Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | Latest ✔ | 11 ✔ |

[![Browser Matrix](https://saucelabs.com/open_sauce/build_matrix/axios.svg)](https://saucelabs.com/u/axios)

## Installing

Using npm:

```bash
npm install ol-glmp
```

## Example

Load a layer

```js
import WebGLayer from "ol-glmp/layer/WebGLPolygon";
import Webc from "ol-glmp/source/Webc";
let layer = new WebGLayer({
    source: new Webc(),
       style: {
        // color setting   '#fff' or 'rgb(255,255,255)' or 'rgba(255,255,255,1)'
         color: "#ff0000"
       }
    });
// Openlayer add layer   see  https://openlayers.org/
var vectorSource = new Webc({
    loader: function(extent, resolution, projection) {
      var proj = projection.getCode();
      vectorSource.addFeatures(
          //Geojson data
          vectorSource.getFormat().readFeatures( data  , {
              featureProjection: projection
            })
          );
        }
    });
layer.setSource(vectorSource);
map.addLayer(layer);

```





## License

MIT
