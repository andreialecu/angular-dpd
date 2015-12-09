(function () {
  "use strict";

  var angularDpdSockets = [];

  angular.module('dpd', []).value('dpdConfig', [])
    .factory('dpdSocket', ['$rootScope', 'dpdConfig', function ($rootScope, dpdConfig) {
      if (!dpdConfig.useSocketIo) {
        return undefined;
      }
      if (!io.connect) {
        throw ('angular-dpd: socket.io library not available, include the client library or set dpdConfig.useSocketIo = false');
      }
      var socketUrl = dpdConfig.socketOptions ? dpdConfig.socketOptions.url || dpdConfig.serverRoot : dpdConfig.serverRoot;
      var socket = angularDpdSockets[socketUrl] = angularDpdSockets[socketUrl] || io.connect(socketUrl, dpdConfig.socketOptions);
      var listeners = {};
      return {
        on: function (eventName, callback) {
          listeners[callback] = function () {
            var args = arguments;
            $rootScope.$apply(function () {
              callback.apply(socket, args);
            });
          };
          socket.on(eventName, listeners[callback]);
        },
        emit: function (eventName, data, callback) {
          socket.emit(eventName, data, function () {
            var args = arguments;
            $rootScope.$apply(function () {
              if (callback) {
                callback.apply(socket, args);
              }
            });
          });
        },
        removeListener: function (eventName, f) {
          socket.removeListener(eventName, listeners[f]);
          delete listeners[f];
        },
        rawSocket: socket
      };
    }])
    .factory('dpd', ['$http', '$rootScope', 'dpdConfig', 'dpdSocket', function ($http, $rootScope, dpdConfig, dpdSocket) {
      var dpd = {};
      var _sessionId = null;

      dpd.errors = [];
      dpd.socket = dpdSocket;
      if (angular.isArray(dpdConfig)) {
        dpdConfig = {
          collections: dpdConfig
        };
      }

      var serverRoot = dpdConfig.serverRoot.replace(/\/$/, "") || "";

      if (!Array.prototype.forEach) {
        Array.prototype.forEach = function (fn, scope) {
          for (var i = 0, len = this.length; i < len; ++i) {
            fn.call(scope, this[i], i, this);
          }
        };
      }

      var ef = function (data, status, headers, config) {
        dpd.errors.push(data);
      };

      var isComplexQuery = function (obj) {
        if (obj) {
          for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
              if (typeof obj[k] === 'object') {
                return true;
              }
            }
          }
        }
        return false;
      };

      var prepareOptions = function (options) {
        options = options || {};
        if (dpdConfig.useBearerAuth) {
          options.headers = options.headers || {};
          options.headers = angular.extend({ "Authorization": "Bearer" + (_sessionId ? " " + _sessionId : "") }, options.headers);
        } else {
          options = angular.extend({ withCredentials: true }, options);
        }
        return options;
      }

      var doGet = function(collection, query, options) {
        options = prepareOptions(options);
        if (typeof query == "string") {
          return $http.get(serverRoot + '/' + collection + '/' + query, options);
        } else {
          if (typeof query == "undefined") {
            return $http.get(serverRoot + '/' + collection, options);
          } else {
            if (isComplexQuery(query)) {
              var query = encodeURI(JSON.stringify(query));
              return $http.get(serverRoot + '/' + collection + '?' + query, options);
            } else {
              options.params = query;
              return $http.get(serverRoot + '/' + collection, options);
            }
          }
        }
      }

      dpdConfig.collections.forEach(function (collection) {
        dpd[collection] = {};

        dpd[collection].get = function (query, options) {
          return doGet(collection, query, options).error(ef);
        };

        dpd[collection].put = function (id, data, options) {
          options = prepareOptions(options);
          return $http.put(serverRoot + '/' + collection + '/' + id, data, options).error(ef);
        };

        dpd[collection].post = function (data, options) {
          options = prepareOptions(options);
          return $http.post(serverRoot + '/' + collection + '/', data, options)
            .success(function(data, status, headers){
              if (headers("X-Session-Token")) console.log(headers("X-Session-Token"));
            })
            .error(ef);
        };

        dpd[collection].del = dpd[collection].delete = function (id, options) {
          options = prepareOptions(options);
          return $http.delete(serverRoot + '/' + collection + '/' + id, options).error(ef);
        };

        dpd[collection].save = function (obj, options) {
          options = prepareOptions(options);
          if (typeof obj.id == 'string') {
            return dpd[collection].put(obj.id, obj, options);
          } else {
            return dpd[collection].post(obj, options);
          }
        };

        dpd[collection].exec = function (funcName, data, options) {
          var options = angular.extend({
            method: "POST",
            url: serverRoot + '/' + collection + '/' + funcName
          }, options);
          options = prepareOptions(options);
          if (/(POST|PUT)/i.test(options.method)) {
            options.data = data;
          } else {
            options.params = data;
          }

          return $http(options)
            .success(function(data, status, headers){
              var sessionToken = headers("X-Session-Token");
              if (sessionToken) dpd.setSessionId(sessionToken);
            })
            .error(ef);
        };

        dpd[collection].on = function (scope, event, f) {
          if (!dpdSocket) return;
          if (typeof scope !== 'object' || !scope.$on) {
            throw new Error("Invalid scope. Please pass an angular scope as the first parameter.");
          }
          dpdSocket.on(collection + ':' + event, f);
          scope.$on("$destroy", function () {
            dpdSocket.removeListener(collection + ':' + event, f);
          });
        };
      });

      dpd.on = function (scope, event, f) {
        if (!dpdSocket) return;
        if (typeof scope !== 'object' || !scope.$on) {
          throw new Error("Invalid scope. Please pass an angular scope as the first parameter.");
        }
        dpdSocket.on(event, f);
        scope.$on("$destroy", function() {
          dpdSocket.removeListener(event, f);
        });
      };

      dpd.setSessionId = function (sessionId, force) {
        if (!dpdConfig.useBearerAuth) throw new Error("dpdConfig.useBearerAuth must be true");
        if (force || sessionId && _sessionId !== sessionId) {
          if (dpdSocket) dpdSocket.emit("server:setSession", { sid: sessionId });
          _sessionId = sessionId;
        }
      };

      if (dpdSocket && dpdSocket.on) dpdSocket.on("reconnect", function(){
        if (_sessionId) dpd.setSessionId(_sessionId, true);
      });

      return dpd;
    }]);
})();
