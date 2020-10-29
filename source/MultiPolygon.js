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
 * @module ol/geom/MultiPolygon
 */
import {
  extend
} from 'ol/array.js';
import {
  closestSquaredDistanceXY
} from 'ol/extent.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import GeometryType from 'ol/geom/GeometryType.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import Polygon from 'ol/geom/Polygon.js';
import SimpleGeometry from 'ol/geom/SimpleGeometry.js';
import {
  linearRingss as linearRingssArea
} from 'ol/geom/flat/area.js';
import {
  linearRingss as linearRingssCenter
} from 'ol/geom/flat/center.js';
import {
  assignClosestMultiArrayPoint,
  multiArrayMaxSquaredDelta
} from 'ol/geom/flat/closest.js';
import {
  linearRingssContainsXY
} from 'ol/geom/flat/contains.js';
import {
  inflateMultiCoordinatesArray
} from 'ol/geom/flat/inflate.js';
import {
  getInteriorPointsOfMultiArray
} from 'ol/geom/flat/interiorpoint.js';
import {
  intersectsLinearRingMultiArray
} from 'ol/geom/flat/intersectsextent.js';
import {
  linearRingssAreOriented,
  orientLinearRingsArray
} from 'ol/geom/flat/orient.js';
import {
  quantizeMultiArray
} from 'ol/geom/flat/simplify.js';
import {
  deflateCoordinatesArray,
  deflateMultiCoordinatesArray
} from './deflate.js';
/**
 * @classdesc
 * Multi-polygon geometry.
 *
 * @api
 */
var MultiPolygon = /** @class */ (function (_super) {
  __extends(MultiPolygon, _super);
  /**
   * @param {Array<Array<Array<import("../coordinate.js").Coordinate>>|Polygon>|Array<number>} coordinates Coordinates.
   *     For internal use, flat coordinates in combination with `opt_layout` and `opt_endss` are also accepted.
   * @param {GeometryLayout=} opt_layout Layout.
   * @param {Array<Array<number>>=} opt_endss Array of ends for internal use with flat coordinates.
   */
  function MultiPolygon(coordinates, opt_layout, opt_endss) {
    // console.log(coordinates)
    var _this = _super.call(this) || this;
    /**
     * @type {Array<Array<number>>}
     * @private
     */
    _this.endss_ = [];
    _this.stride = 3;
    _this.glStride = 2;
    /**
     * @private
     * @type {number}
     */
    _this.flatInteriorPointsRevision_ = -1;
    /**
     * @private
     * @type {Array<number>}
     */
    _this.flatInteriorPoints_ = null;
    /**
     * @private
     * @type {number}
     */
    _this.maxDelta_ = -1;
    /**
     * @private
     * @type {number}
     */
    _this.maxDeltaRevision_ = -1;
    /**
     * @private
     * @type {number}
     */
    _this.orientedRevision_ = -1;
    /**
     * @private
     * @type {Array<number>}
     */
    _this.orientedFlatCoordinates_ = null;
    if (!opt_endss && !Array.isArray(coordinates[0])) {
      var layout = _this.getLayout();
      var polygons = /** @type {Array<Polygon>} */ (coordinates);
      var flatCoordinates = [];
      var endss = [];
      for (var i = 0, ii = polygons.length; i < ii; ++i) {
        var polygon = polygons[i];
        if (i === 0) {
          layout = polygon.getLayout();
        }
        var offset = flatCoordinates.length;
        var ends = polygon.getEnds();
        for (var j = 0, jj = ends.length; j < jj; ++j) {
          ends[j] += offset;
        }
        extend(flatCoordinates, polygon.getFlatCoordinates());
        endss.push(ends);
      }
      opt_layout = layout;
      coordinates = flatCoordinates;
      opt_endss = endss;
    }
    if (opt_layout !== undefined && opt_endss) {
      _this.setFlatCoordinates(opt_layout, /** @type {Array<number>} */ (coordinates));
      _this.endss_ = opt_endss;
    } else {
      _this.setCoordinates( /** @type {Array<Array<Array<import("../coordinate.js").Coordinate>>>} */ (coordinates), opt_layout);
    }
    return _this;
  }
  /**
   * Append the passed polygon to this multipolygon.
   * @param {Polygon} polygon Polygon.
   * @api
   */
  MultiPolygon.prototype.appendPolygon = function (polygon) {
    /** @type {Array<number>} */
    var ends;
    if (!this.flatCoordinates) {
      this.flatCoordinates = polygon.getFlatCoordinates().slice();
      ends = polygon.getEnds().slice();
      this.endss_.push();
    } else {
      var offset = this.flatCoordinates.length;
      extend(this.flatCoordinates, polygon.getFlatCoordinates());
      ends = polygon.getEnds().slice();
      for (var i = 0, ii = ends.length; i < ii; ++i) {
        ends[i] += offset;
      }
    }
    this.endss_.push(ends);
    this.changed();
  };
  /**
   * Make a complete copy of the geometry.
   * @return {!MultiPolygon} Clone.
   * @override
   * @api
   */
  MultiPolygon.prototype.clone = function () {
    var len = this.endss_.length;
    var newEndss = new Array(len);
    for (var i = 0; i < len; ++i) {
      newEndss[i] = this.endss_[i].slice();
    }
    return new MultiPolygon(this.flatCoordinates.slice(), this.layout, newEndss);
  };
  /**
   * @inheritDoc
   */
  MultiPolygon.prototype.closestPointXY = function (x, y, closestPoint, minSquaredDistance) {
    if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
      return minSquaredDistance;
    }
    if (this.maxDeltaRevision_ != this.getRevision()) {
      this.maxDelta_ = Math.sqrt(multiArrayMaxSquaredDelta(this.flatCoordinates, 0, this.endss_, this.stride, 0));
      this.maxDeltaRevision_ = this.getRevision();
    }
    return assignClosestMultiArrayPoint(this.getOrientedFlatCoordinates(), 0, this.endss_, this.stride, this.maxDelta_, true, x, y, closestPoint, minSquaredDistance);
  };
  /**
   * @inheritDoc
   */
  MultiPolygon.prototype.containsXY = function (x, y) {
    return linearRingssContainsXY(this.getOrientedFlatCoordinates(), 0, this.endss_, this.stride, x, y);
  };
  /**
   * Return the area of the multipolygon on projected plane.
   * @return {number} Area (on projected plane).
   * @api
   */
  MultiPolygon.prototype.getArea = function () {
    return linearRingssArea(this.getOrientedFlatCoordinates(), 0, this.endss_, this.stride);
  };
  /**
   * Get the coordinate array for this geometry.  This array has the structure
   * of a GeoJSON coordinate array for multi-polygons.
   *
   * @param {boolean=} opt_right Orient coordinates according to the right-hand
   *     rule (counter-clockwise for exterior and clockwise for interior rings).
   *     If `false`, coordinates will be oriented according to the left-hand rule
   *     (clockwise for exterior and counter-clockwise for interior rings).
   *     By default, coordinate orientation will depend on how the geometry was
   *     constructed.
   * @return {Array<Array<Array<import("../coordinate.js").Coordinate>>>} Coordinates.
   * @override
   * @api
   */
  MultiPolygon.prototype.getCoordinates = function (opt_right) {
    var flatCoordinates;
    if (opt_right !== undefined) {
      flatCoordinates = this.getOrientedFlatCoordinates().slice();
      orientLinearRingsArray(flatCoordinates, 0, this.endss_, this.stride, opt_right);
    } else {
      flatCoordinates = this.flatCoordinates;
    }
    return inflateMultiCoordinatesArray(flatCoordinates, 0, this.endss_, this.stride);
  };
  /**
   * @return {Array<Array<number>>} Endss.
   */
  MultiPolygon.prototype.getEndss = function () {
    return this.endss_;
  };
  /**
   * @return {Array<number>} Flat interior points.
   */
  MultiPolygon.prototype.getFlatInteriorPoints = function () {
    if (this.flatInteriorPointsRevision_ != this.getRevision()) {
      var flatCenters = linearRingssCenter(this.flatCoordinates, 0, this.endss_, this.stride);
      this.flatInteriorPoints_ = getInteriorPointsOfMultiArray(this.getOrientedFlatCoordinates(), 0, this.endss_, this.stride, flatCenters);
      this.flatInteriorPointsRevision_ = this.getRevision();
    }
    return this.flatInteriorPoints_;
  };
  /**
   * Return the interior points as {@link module:ol/geom/MultiPoint multipoint}.
   * @return {MultiPoint} Interior points as XYM coordinates, where M is
   * the length of the horizontal intersection that the point belongs to.
   * @api
   */
  MultiPolygon.prototype.getInteriorPoints = function () {
    return new MultiPoint(this.getFlatInteriorPoints().slice(), GeometryLayout.XYM);
  };
  /**
   * @return {Array<number>} Oriented flat coordinates.
   */
  MultiPolygon.prototype.getOrientedFlatCoordinates = function () {
    if (this.orientedRevision_ != this.getRevision()) {
      var flatCoordinates = this.flatCoordinates;
      if (linearRingssAreOriented(flatCoordinates, 0, this.endss_, this.stride)) {
        this.orientedFlatCoordinates_ = flatCoordinates;
      } else {
        this.orientedFlatCoordinates_ = flatCoordinates.slice();
        this.orientedFlatCoordinates_.length =
          orientLinearRingsArray(this.orientedFlatCoordinates_, 0, this.endss_, this.stride);
      }
      this.orientedRevision_ = this.getRevision();
    }
    return this.orientedFlatCoordinates_;
  };
  /**
   * @inheritDoc
   */
  MultiPolygon.prototype.getSimplifiedGeometryInternal = function (squaredTolerance) {
    var simplifiedFlatCoordinates = [];
    var simplifiedEndss = [];
    simplifiedFlatCoordinates.length = quantizeMultiArray(this.flatCoordinates, 0, this.endss_, this.stride, Math.sqrt(squaredTolerance), simplifiedFlatCoordinates, 0, simplifiedEndss);
    return new MultiPolygon(simplifiedFlatCoordinates, GeometryLayout.XY, simplifiedEndss);
  };
  /**
   * Return the polygon at the specified index.
   * @param {number} index Index.
   * @return {Polygon} Polygon.
   * @api
   */
  MultiPolygon.prototype.getPolygon = function (index) {
    if (index < 0 || this.endss_.length <= index) {
      return null;
    }
    var offset;
    if (index === 0) {
      offset = 0;
    } else {
      var prevEnds = this.endss_[index - 1];
      offset = prevEnds[prevEnds.length - 1];
    }
    var ends = this.endss_[index].slice();
    var end = ends[ends.length - 1];
    if (offset !== 0) {
      for (var i = 0, ii = ends.length; i < ii; ++i) {
        ends[i] -= offset;
      }
    }
    return new Polygon(this.flatCoordinates.slice(offset, end), this.layout, ends);
  };
  /**
   * Return the polygons of this multipolygon.
   * @return {Array<Polygon>} Polygons.
   * @api
   */
  MultiPolygon.prototype.getPolygons = function () {
    var layout = this.layout;
    var flatCoordinates = this.flatCoordinates;
    var endss = this.endss_;
    var polygons = [];
    var offset = 0;
    for (var i = 0, ii = endss.length; i < ii; ++i) {
      var ends = endss[i].slice();
      var end = ends[ends.length - 1];
      if (offset !== 0) {
        for (var j = 0, jj = ends.length; j < jj; ++j) {
          ends[j] -= offset;
        }
      }
      var polygon = new Polygon(flatCoordinates.slice(offset, end), layout, ends);
      polygons.push(polygon);
      offset = end;
    }
    return polygons;
  };
  /**
   * @inheritDoc
   * @api
   */
  MultiPolygon.prototype.getType = function () {
    return GeometryType.MULTI_POLYGON;
  };
  /**
   * @inheritDoc
   * @api
   */
  MultiPolygon.prototype.intersectsExtent = function (extent) {
    return intersectsLinearRingMultiArray(this.getOrientedFlatCoordinates(), 0, this.endss_, this.stride, extent);
  };
  /**
   * Set the coordinates of the multipolygon.
   * @param {!Array<Array<Array<import("../coordinate.js").Coordinate>>>} coordinates Coordinates.
   * @param {GeometryLayout=} opt_layout Layout.
   * @override
   * @api
   */
  function getLayoutForStride(stride) {
    var layout;
    if (stride == 2) {
      layout = GeometryLayout.XY;
    } else if (stride == 3) {
      layout = GeometryLayout.XYZ;
    } else if (stride == 4) {
      layout = GeometryLayout.XYZM;
    }
    return (
      /** @type {GeometryLayout} */
      (layout));
  }
  MultiPolygon.prototype.setLayout = function (layout, coordinates, nesting) {
    /** @type {number} */
    var stride;
    if (layout) {
      stride = getStrideForLayout(layout);
    } else {
      for (var i = 0; i < nesting; ++i) {
        if (coordinates.length === 0) {
          this.layout = GeometryLayout.XY;
          this.stride = 2;
          return;
        } else {
          coordinates = /** @type {Array} */ (coordinates[0]);
        }
      }
      stride = coordinates.length;
      layout = getLayoutForStride(stride);
    }
    this.layout = layout;
    this.stride = stride + 1;
    this.glStride = stride;
  };
  MultiPolygon.prototype.setCoordinates = function (coordinates, opt_layout) {
    this.setLayout(opt_layout, coordinates, 3);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }
    var endss = deflateMultiCoordinatesArray(this.flatCoordinates, 0, coordinates, this.glStride, this.endss_);
    if (endss.length === 0) {
      this.flatCoordinates.length = 0;
    } else {
      var lastEnds = endss[endss.length - 1];
      this.flatCoordinates.length = lastEnds.length === 0 ?
        0 : lastEnds[lastEnds.length - 1];
    }
    this.changed();
  };
  return MultiPolygon;
}(SimpleGeometry));
export default MultiPolygon;
//# sourceMappingURL=MultiPolygon.js.map