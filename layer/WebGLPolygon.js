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

import {
  assign
} from 'ol/obj.js';
import WebGLayerRenderer from './glPolyon.js';
import Layer from 'ol/layer/Layer.js';

var WebGLayer = /** @class */ (function (_super) {
  __extends(WebGLayer, _super);
  /**
   * @param {Options} options Options.
   */
  function WebGLayer(options) {
    var _this = this;
    var baseOptions = assign({}, options);
    _this = _super.call(this, baseOptions) || this;
    _this.style = options.style;
    /**
     * @private
     * @type {import('../webgl/ShaderBuilder.js').StyleParseResult}
     */
    // _this.parseResult_ = parseLiteralStyle(options.style);
    /**
     * @private
     * @type {boolean}
     */
    _this.hitDetectionDisabled_ = !!options.disableHitDetection;
    return _this;
  }
  /**
   * @inheritDoc
   */
  WebGLayer.prototype.createRenderer = function () {
    return new WebGLayerRenderer(this, {
      style: this.style
    });
  };
  /**
   *
   * @inheritDoc
   */
  WebGLayer.prototype.disposeInternal = function () {
    this.renderer_.dispose();
    _super.prototype.disposeInternal.call(this);
  };
  return WebGLayer;
}(Layer));
export default WebGLayer;
//# sourceMappingURL=WebGLPoints.js.map
