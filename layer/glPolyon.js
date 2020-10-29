var __extends = (this && this.__extends) || (function () {
  var extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
      ({
          __proto__: []
        }
        instanceof Array && function (d, b) {
          d.__proto__ = b;
        }) ||
      function (d, b) {
        for (var p in b)
          if (b.hasOwnProperty(p)) d[p] = b[p];
      };
    return extendStatics(d, b);
  };
  return function (d, b) {
    extendStatics(d, b);

    function __() {
      this.constructor = d;
    }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };
})();
/**
 * @module ol/renderer/webgl/PointsLayer
 */


import GeometryType from 'ol/geom/GeometryType.js';
import WebGLLayerRenderer from 'ol/renderer/webgl/Layer';
import ViewHint from 'ol/ViewHint.js';
import {
  buffer,
  createEmpty,
  equals
} from 'ol/extent.js';

import {
  getUid
} from 'ol/util.js';


import BaseVector from 'ol/layer/BaseVector.js';
import {
  listen,
  unlistenByKey
} from 'ol/events.js';
import VectorEventType from 'ol/source/VectorEventType.js';
var CONTEXT_IDS = [
  'experimental-webgl',
  'webgl',
  'webkit-3d',
  'moz-webgl'
];

function getContext(canvas, opt_attributes) {
  var ii = CONTEXT_IDS.length;
  for (var i = 0; i < ii; ++i) {
    try {
      var context = canvas.getContext(CONTEXT_IDS[i], opt_attributes);
      if (context) {
        return /** @type {!WebGLRenderingContext} */ (context);
      }
    } catch (e) {
      // pass
    }
  }
  return null;
}

function colorRgba(sHex) {
  var reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/
  let sColor = sHex.toLowerCase();
  var sColorChange = [];
  if (sColor && reg.test(sColor)) {
    if (sColor.length === 4) {
      var sColorNew = '#'
      for (let i = 1; i < 4; i += 1) {
        sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1))
      }
      sColor = sColorNew
    }
    for (let i = 1; i < 7; i += 2) {
      sColorChange.push(parseInt('0x' + sColor.slice(i, i + 2)) / 255)
    }
    sColorChange.push(1);
  } else {
    var start = sColor.indexOf('(');
    var end = sColor.indexOf(')');
    if (start != -1 && end != -1) {
      var sColorChange = [];
      sColor = sColor.substring(start + 1, end).split(',');
      var alpha;
      if (sColor.length == 4) {
        alpha = sColor.splice(3);
      }
      for (let i = 0; i < sColor.length; i++) {
        sColorChange.push(sColor[i] / 255);
      }
      sColorChange.push(alpha ? +alpha[0] : 1);
    }
  }
  return sColorChange;
}

function initPropgram(gl, options) {
  var color = options.style && options.style.color ? colorRgba(options.style.color) : [1.0, 0.0, 0.0, 1.0];
  var vertexShaderSource = `
  precision mediump float;
  attribute vec3 a_Position;
  attribute vec3 a_Resolution;
  attribute vec3 a_Screen_Size;
  attribute vec3 a_PixelRatio;
  attribute vec3 a_Extent;
  varying vec3 u_Value;
  void main(){
    vec3 position = (((a_Position - a_Extent) * vec3(1.0, -1.0,1.0)/ a_Screen_Size/a_Resolution* a_PixelRatio) * vec3(2.0, 2.0,1.0) - vec3(1.0, 1.0,0));
    position = position * vec3(1.0, -1.0,1.0);
    u_Value = position;
    gl_Position =  vec4(position, 1.0);
  }
  `;
  var fragmentShaderSource = `
  precision mediump float;
  varying vec3 u_Value;
  void main(){
    float position = u_Value.z;
    if(position  == 1.0 ){
      gl_FragColor = vec4(${color.join()});
    }else{
      gl_FragColor = vec4(0.0,  0.0,  0.0,  0.0);
    }
  }
`
  let vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  var propgram = gl.createProgram();
  gl.attachShader(propgram, vertexShader);
  gl.attachShader(propgram, fragmentShader);
  gl.linkProgram(propgram);
  gl.useProgram(propgram);
  return propgram;
}
var WebGLayerRenderer = /** @class */ (function (_super) {
  __extends(WebGLayerRenderer, _super);
  /**
   * @param {import("../../layer/Layer.js").default} layer Layer.
   * @param {Options} options Options.
   */
  function WebGLayerRenderer(layer, options) {
    var _this = this;
    // var uniforms = options.uniforms || {};
    // var projectionMatrixTransform = createTransform();
    // uniforms[DefaultUniform.PROJECTION_MATRIX] = projectionMatrixTransform;
    _this = _super.call(this, layer, {
      // uniforms: uniforms,
      // postProcesses: options.postProcesses
    }) || this;
    _this.sourceRevision_ = -1;

    _this.canvas_ = document.createElement('canvas');
    _this.canvas_.style.position = 'absolute';
    _this.canvas_.style.left = '0';

    _this.gl_ = getContext(_this.canvas_);
    _this.propgram_ = initPropgram(_this.gl_, options);
    _this.gl_.bindBuffer(_this.gl_.ARRAY_BUFFER, _this.gl_.createBuffer());
    _this.glBufferLen_ = null;
    _this.glBufferByte_ = 4;
    _this.previousExtent_ = createEmpty();
    /**
     * This object will be updated when the source changes. Key is uid.
     * @type {Object<string, FeatureCacheItem>}
     * @private
     */
    _this.featureCache_ = {};
    /**
     * Amount of features in the cache.
     * @type {number}
     * @private
     */
    _this.featureCount_ = 0;
    var source = _this.getLayer().getSource();
    _this.sourceListenKeys_ = [
      listen(source, VectorEventType.ADDFEATURE, _this.handleSourceFeatureAdded_, _this),
      listen(source, VectorEventType.CHANGEFEATURE, _this.handleSourceFeatureChanged_, _this),
      listen(source, VectorEventType.REMOVEFEATURE, _this.handleSourceFeatureDelete_, _this)
    ];
    source.forEachFeature(function (feature) {
      this.featureCache_[getUid(feature)] = {
        feature: feature,
        properties: feature.getProperties(),
        geometry: feature.getGeometry()
      };
      this.featureCount_++;
    }.bind(_this));
    // console.log(_this.featureCache_, Object.keys(_this.featureCache_))
    return _this;
  }
  /**
   * @param {import("../../source/Vector.js").VectorSourceEvent} event Event.
   * @private
   */
  WebGLayerRenderer.prototype.handleSourceFeatureAdded_ = function (event) {

    var feature = event.feature;
    this.featureCache_[getUid(feature)] = {
      feature: feature,
      properties: feature.getProperties(),
      geometry: feature.getGeometry()
    };
    this.featureCount_++;
  };
  /**
   * @param {import("../../source/Vector.js").VectorSourceEvent} event Event.
   * @private
   */
  WebGLayerRenderer.prototype.handleSourceFeatureChanged_ = function (event) {
    var feature = event.feature;
    this.featureCache_[getUid(feature)] = {
      feature: feature,
      properties: feature.getProperties(),
      geometry: feature.getGeometry()
    };
  };
  /**
   * @param {import("../../source/Vector.js").VectorSourceEvent} event Event.
   * @private
   */
  WebGLayerRenderer.prototype.handleSourceFeatureDelete_ = function (event) {
    var feature = event.feature;
    delete this.featureCache_[getUid(feature)];
    this.featureCount_--;
  };
  /**
   * @inheritDoc
   */

  WebGLayerRenderer.prototype.getGL = function () {
    return this.gl_;
  };
  WebGLayerRenderer.prototype.getCanvas = function () {
    return this.canvas_;
  };
  WebGLayerRenderer.prototype.renderFrame = function () {
    return this.getCanvas();
  };
  /**
   * @inheritDoc
   */

  WebGLayerRenderer.prototype.prepareFrame = function (frameState) {
    var layer = this.getLayer();
    var vectorSource = layer.getSource();
    var viewState = frameState.viewState;
    var gl = this.getGL();
    var canvas = this.getCanvas();
    var size = frameState.size;
    var pixelRatio = frameState.pixelRatio;
    canvas.width = size[0] * pixelRatio;
    canvas.height = size[1] * pixelRatio;
    canvas.style.width = size[0] + 'px';
    canvas.style.height = size[1] + 'px';
    var viewNotMoving = !frameState.viewHints[ViewHint.ANIMATING] && !frameState.viewHints[ViewHint.INTERACTING];
    var extentChanged = !equals(this.previousExtent_, frameState.extent);
    var sourceChanged = this.sourceRevision_ < vectorSource.getRevision();
    if (sourceChanged) {
      this.sourceRevision_ = vectorSource.getRevision();
    }
    if ((extentChanged || sourceChanged)) {
      if (!vectorSource.isEmpty()) {
        let a_Position = gl.getAttribLocation(this.propgram_, 'a_Position');
        let a_Resolution = gl.getAttribLocation(this.propgram_, 'a_Resolution');
        let a_Screen_Size = gl.getAttribLocation(this.propgram_, 'a_Screen_Size');
        let a_Extent = gl.getAttribLocation(this.propgram_, 'a_Extent');
        let a_PixelRatio = gl.getAttribLocation(this.propgram_, 'a_PixelRatio');
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.vertexAttrib3f(a_Resolution, viewState.resolution, viewState.resolution, 1.0);
        gl.vertexAttrib3f(a_PixelRatio, frameState.pixelRatio, frameState.pixelRatio, 1.0);
        gl.vertexAttrib3f(a_Screen_Size, canvas.width, canvas.height, 1.0);
        gl.vertexAttrib3f(a_Extent, frameState.extent[0], frameState.extent[3], 0.0);
        gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(a_Position);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!this.glBufferLen_) {
          var offset = 0;
          gl.bufferData(gl.ARRAY_BUFFER, vectorSource.glBufferLen * this.glBufferByte_, gl.DYNAMIC_DRAW);
          vectorSource.forEachFeature(item => {
            var feature = item.getGeometry();
            gl.bufferSubData(
              gl.ARRAY_BUFFER,
              offset * this.glBufferByte_,
              new Float32Array(feature.flatCoordinates)
            );
            offset += feature.flatCoordinates.length;
          })
          this.glBufferLen_ = vectorSource.glBufferLen / 3;
        }
        gl.drawArrays(gl.LINE_STRIP, 0, this.glBufferLen_);
      }
    }
    if (viewNotMoving && (extentChanged || sourceChanged)) {
      var projection = viewState.projection;
      var resolution = viewState.resolution;
      var renderBuffer = layer instanceof BaseVector ? layer.getRenderBuffer() : 0;
      var extent = buffer(frameState.extent, renderBuffer * resolution);
      vectorSource.loadFeatures(extent, resolution, projection);
    }
    return true;
  };
  /**
   * Rebuild internal webgl buffers based on current view extent; costly, should not be called too much
   * @param {import("../../PluggableMap").FrameState} frameState Frame state.
   * @private
   */
  WebGLayerRenderer.prototype.rebuildBuffers_ = function (frameState) {
    // // saves the projection transform for the current frame state
    // var projectionTransform = createTransform();
    // // debugger
    // this.helper.makeProjectionTransform(frameState, projectionTransform);
    // // here we anticipate the amount of render instructions that we well generate
    // // this can be done since we know that for normal render we only have x, y as base instructions,
    // // and x, y, r, g, b, a and featureUid for hit render instructions
    // // and we also know the amount of custom attributes to append to these
    // var totalInstructionsCount = (2 + this.customAttributes.length) * this.featureCount_;
    // if (!this.renderInstructions_ || this.renderInstructions_.length !== totalInstructionsCount) {
    //   this.renderInstructions_ = new Float32Array(totalInstructionsCount);
    // }
    // if (this.hitDetectionEnabled_) {
    //   var totalHitInstructionsCount = (7 + this.customAttributes.length) * this.featureCount_;
    //   if (!this.hitRenderInstructions_ || this.hitRenderInstructions_.length !== totalHitInstructionsCount) {
    //     this.hitRenderInstructions_ = new Float32Array(totalHitInstructionsCount);
    //   }
    // }
    // // loop on features to fill the buffer
    // var featureCache, geometry;
    // var tmpCoords = [];
    // var tmpColor = [];
    // var renderIndex = 0;
    // var hitIndex = 0;
    // var hitColor;

    // for (var featureUid in this.featureCache_) {
    //   featureCache = this.featureCache_[featureUid];
    //   geometry = /** @type {import("../../geom").Point} */ (featureCache.geometry);
    //   if (!geometry || geometry.getType() !== GeometryType.POINT) {
    //     continue;
    //   }
    //   //   debugger
    //   tmpCoords[0] = geometry.getFlatCoordinates()[0];
    //   tmpCoords[1] = geometry.getFlatCoordinates()[1];
    //   applyTransform(projectionTransform, tmpCoords);
    //   hitColor = colorEncodeId(hitIndex + 6, tmpColor);
    //   this.renderInstructions_[renderIndex++] = tmpCoords[0];
    //   this.renderInstructions_[renderIndex++] = tmpCoords[1];
    //   // for hit detection, the feature uid is saved in the opacity value
    //   // and the index of the opacity value is encoded in the color values
    //   if (this.hitDetectionEnabled_) {
    //     this.hitRenderInstructions_[hitIndex++] = tmpCoords[0];
    //     this.hitRenderInstructions_[hitIndex++] = tmpCoords[1];
    //     this.hitRenderInstructions_[hitIndex++] = hitColor[0];
    //     this.hitRenderInstructions_[hitIndex++] = hitColor[1];
    //     this.hitRenderInstructions_[hitIndex++] = hitColor[2];
    //     this.hitRenderInstructions_[hitIndex++] = hitColor[3];
    //     this.hitRenderInstructions_[hitIndex++] = Number(featureUid);
    //   }
    //   // pushing custom attributes
    //   var value = void 0;
    //   for (var j = 0; j < this.customAttributes.length; j++) {
    //     value = this.customAttributes[j].callback(featureCache.feature, featureCache.properties);
    //     this.renderInstructions_[renderIndex++] = value;
    //     if (this.hitDetectionEnabled_) {
    //       this.hitRenderInstructions_[hitIndex++] = value;
    //     }
    //   }
    // }
    // /** @type {import('./Layer').WebGLWorkerGenerateBuffersMessage} */
    // var message = {
    //   type: WebGLWorkerMessageType.GENERATE_BUFFERS,
    //   renderInstructions: this.renderInstructions_.buffer,
    //   customAttributesCount: this.customAttributes.length,
    // };
    // // additional properties will be sent back as-is by the worker
    // message['projectionTransform'] = projectionTransform;
    // // this.worker_.postMessage(message, [this.renderInstructions_.buffer]);
    // this.renderInstructions_ = null;
    // /** @type {import('./Layer').WebGLWorkerGenerateBuffersMessage} */
    // if (this.hitDetectionEnabled_) {
    //   var hitMessage = {
    //     type: WebGLWorkerMessageType.GENERATE_BUFFERS,
    //     renderInstructions: this.hitRenderInstructions_.buffer,
    //     customAttributesCount: 5 + this.customAttributes.length
    //   };
    //   hitMessage['projectionTransform'] = projectionTransform;
    //   hitMessage['hitDetection'] = true;
    //   // this.worker_.postMessage(hitMessage, [this.hitRenderInstructions_.buffer]);
    //   this.hitRenderInstructions_ = null;
    // }
  };
  /**
   * @inheritDoc
   */
  // WebGLayerRenderer.prototype.forEachFeatureAtCoordinate = function (coordinate, frameState, hitTolerance, callback, declutteredFeatures) {
  //   assert(this.hitDetectionEnabled_, 66);
  //   if (!this.hitRenderInstructions_) {
  //     return;
  //   }
  //   var pixel = applyTransform(frameState.coordinateToPixelTransform, coordinate.slice());
  //   var data = this.hitRenderTarget_.readPixel(pixel[0] / 2, pixel[1] / 2);
  //   var color = [
  //     data[0] / 255,
  //     data[1] / 255,
  //     data[2] / 255,
  //     data[3] / 255
  //   ];
  //   var index = colorDecodeId(color);
  //   var opacity = this.hitRenderInstructions_[index];
  //   var uid = Math.floor(opacity).toString();
  //   var source = this.getLayer().getSource();
  //   var feature = source.getFeatureByUid(uid);
  //   if (feature) {
  //     return callback(feature, this.getLayer());
  //   }
  // };
  /**
   * Render the hit detection data to the corresponding render target
   * @param {import("../../PluggableMap.js").FrameState} frameState current frame state
   */
  WebGLayerRenderer.prototype.renderHitDetection = function (frameState) {
    // skip render entirely if vertex buffers not ready/generated yet
    // if (!this.hitVerticesBuffer_.getSize()) {
    //   return;
    // }
    // this.hitRenderTarget_.setSize([
    //   Math.floor(frameState.size[0] / 2),
    //   Math.floor(frameState.size[1] / 2)
    // ]);
    // this.helper.useProgram(this.hitProgram_);
    // this.helper.prepareDrawToRenderTarget(frameState, this.hitRenderTarget_, true);
    // this.helper.bindBuffer(this.hitVerticesBuffer_);
    // this.helper.bindBuffer(this.indicesBuffer_);
    // this.helper.enableAttributes(this.hitDetectionAttributes);
    // var renderCount = this.indicesBuffer_.getSize();
    // this.helper.drawElements(0, renderCount);
  };
  /**
   * @inheritDoc
   */
  WebGLayerRenderer.prototype.disposeInternal = function () {
    this.layer_ = null;
    this.sourceListenKeys_.forEach(function (key) {
      unlistenByKey(key);
    });
    this.sourceListenKeys_ = null;
    _super.prototype.disposeInternal.call(this);
  };
  return WebGLayerRenderer;
}(WebGLLayerRenderer));
export default WebGLayerRenderer;
//# sourceMappingURL=PointsLayer.js.map
