var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@smithy/core/dist-es/submodules/client/middleware-stack/MiddlewareStack.js
var getAllAliases, getMiddlewareNameWithAliases, constructStack, stepWeights, priorityWeights;
var init_MiddlewareStack = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/middleware-stack/MiddlewareStack.js"() {
    getAllAliases = /* @__PURE__ */ __name((name, aliases) => {
      const _aliases = [];
      if (name) {
        _aliases.push(name);
      }
      if (aliases) {
        for (const alias of aliases) {
          _aliases.push(alias);
        }
      }
      return _aliases;
    }, "getAllAliases");
    getMiddlewareNameWithAliases = /* @__PURE__ */ __name((name, aliases) => {
      return `${name || "anonymous"}${aliases && aliases.length > 0 ? ` (a.k.a. ${aliases.join(",")})` : ""}`;
    }, "getMiddlewareNameWithAliases");
    constructStack = /* @__PURE__ */ __name(() => {
      let absoluteEntries = [];
      let relativeEntries = [];
      let identifyOnResolve = false;
      const entriesNameSet = /* @__PURE__ */ new Set();
      const sort = /* @__PURE__ */ __name((entries) => entries.sort((a2, b2) => stepWeights[b2.step] - stepWeights[a2.step] || priorityWeights[b2.priority || "normal"] - priorityWeights[a2.priority || "normal"]), "sort");
      const removeByName = /* @__PURE__ */ __name((toRemove) => {
        let isRemoved = false;
        const filterCb = /* @__PURE__ */ __name((entry) => {
          const aliases = getAllAliases(entry.name, entry.aliases);
          if (aliases.includes(toRemove)) {
            isRemoved = true;
            for (const alias of aliases) {
              entriesNameSet.delete(alias);
            }
            return false;
          }
          return true;
        }, "filterCb");
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
      }, "removeByName");
      const removeByReference = /* @__PURE__ */ __name((toRemove) => {
        let isRemoved = false;
        const filterCb = /* @__PURE__ */ __name((entry) => {
          if (entry.middleware === toRemove) {
            isRemoved = true;
            for (const alias of getAllAliases(entry.name, entry.aliases)) {
              entriesNameSet.delete(alias);
            }
            return false;
          }
          return true;
        }, "filterCb");
        absoluteEntries = absoluteEntries.filter(filterCb);
        relativeEntries = relativeEntries.filter(filterCb);
        return isRemoved;
      }, "removeByReference");
      const cloneTo = /* @__PURE__ */ __name((toStack) => {
        absoluteEntries.forEach((entry) => {
          toStack.add(entry.middleware, { ...entry });
        });
        relativeEntries.forEach((entry) => {
          toStack.addRelativeTo(entry.middleware, { ...entry });
        });
        toStack.identifyOnResolve?.(stack.identifyOnResolve());
        return toStack;
      }, "cloneTo");
      const expandRelativeMiddlewareList = /* @__PURE__ */ __name((from) => {
        const expandedMiddlewareList = [];
        from.before.forEach((entry) => {
          if (entry.before.length === 0 && entry.after.length === 0) {
            expandedMiddlewareList.push(entry);
          } else {
            expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
          }
        });
        expandedMiddlewareList.push(from);
        from.after.reverse().forEach((entry) => {
          if (entry.before.length === 0 && entry.after.length === 0) {
            expandedMiddlewareList.push(entry);
          } else {
            expandedMiddlewareList.push(...expandRelativeMiddlewareList(entry));
          }
        });
        return expandedMiddlewareList;
      }, "expandRelativeMiddlewareList");
      const getMiddlewareList = /* @__PURE__ */ __name((debug = false) => {
        const normalizedAbsoluteEntries = [];
        const normalizedRelativeEntries = [];
        const normalizedEntriesNameMap = {};
        absoluteEntries.forEach((entry) => {
          const normalizedEntry = {
            ...entry,
            before: [],
            after: []
          };
          for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
            normalizedEntriesNameMap[alias] = normalizedEntry;
          }
          normalizedAbsoluteEntries.push(normalizedEntry);
        });
        relativeEntries.forEach((entry) => {
          const normalizedEntry = {
            ...entry,
            before: [],
            after: []
          };
          for (const alias of getAllAliases(normalizedEntry.name, normalizedEntry.aliases)) {
            normalizedEntriesNameMap[alias] = normalizedEntry;
          }
          normalizedRelativeEntries.push(normalizedEntry);
        });
        normalizedRelativeEntries.forEach((entry) => {
          if (entry.toMiddleware) {
            const toMiddleware = normalizedEntriesNameMap[entry.toMiddleware];
            if (toMiddleware === void 0) {
              if (debug) {
                return;
              }
              throw new Error(`${entry.toMiddleware} is not found when adding ${getMiddlewareNameWithAliases(entry.name, entry.aliases)} middleware ${entry.relation} ${entry.toMiddleware}`);
            }
            if (entry.relation === "after") {
              toMiddleware.after.push(entry);
            }
            if (entry.relation === "before") {
              toMiddleware.before.push(entry);
            }
          }
        });
        const mainChain = sort(normalizedAbsoluteEntries).map(expandRelativeMiddlewareList).reduce((wholeList, expandedMiddlewareList) => {
          wholeList.push(...expandedMiddlewareList);
          return wholeList;
        }, []);
        return mainChain;
      }, "getMiddlewareList");
      const stack = {
        add: /* @__PURE__ */ __name((middleware, options = {}) => {
          const { name, override, aliases: _aliases } = options;
          const entry = {
            step: "initialize",
            priority: "normal",
            middleware,
            ...options
          };
          const aliases = getAllAliases(name, _aliases);
          if (aliases.length > 0) {
            if (aliases.some((alias) => entriesNameSet.has(alias))) {
              if (!override)
                throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
              for (const alias of aliases) {
                const toOverrideIndex = absoluteEntries.findIndex((entry2) => entry2.name === alias || entry2.aliases?.some((a2) => a2 === alias));
                if (toOverrideIndex === -1) {
                  continue;
                }
                const toOverride = absoluteEntries[toOverrideIndex];
                if (toOverride.step !== entry.step || entry.priority !== toOverride.priority) {
                  throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware with ${toOverride.priority} priority in ${toOverride.step} step cannot be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware with ${entry.priority} priority in ${entry.step} step.`);
                }
                absoluteEntries.splice(toOverrideIndex, 1);
              }
            }
            for (const alias of aliases) {
              entriesNameSet.add(alias);
            }
          }
          absoluteEntries.push(entry);
        }, "add"),
        addRelativeTo: /* @__PURE__ */ __name((middleware, options) => {
          const { name, override, aliases: _aliases } = options;
          const entry = {
            middleware,
            ...options
          };
          const aliases = getAllAliases(name, _aliases);
          if (aliases.length > 0) {
            if (aliases.some((alias) => entriesNameSet.has(alias))) {
              if (!override)
                throw new Error(`Duplicate middleware name '${getMiddlewareNameWithAliases(name, _aliases)}'`);
              for (const alias of aliases) {
                const toOverrideIndex = relativeEntries.findIndex((entry2) => entry2.name === alias || entry2.aliases?.some((a2) => a2 === alias));
                if (toOverrideIndex === -1) {
                  continue;
                }
                const toOverride = relativeEntries[toOverrideIndex];
                if (toOverride.toMiddleware !== entry.toMiddleware || toOverride.relation !== entry.relation) {
                  throw new Error(`"${getMiddlewareNameWithAliases(toOverride.name, toOverride.aliases)}" middleware ${toOverride.relation} "${toOverride.toMiddleware}" middleware cannot be overridden by "${getMiddlewareNameWithAliases(name, _aliases)}" middleware ${entry.relation} "${entry.toMiddleware}" middleware.`);
                }
                relativeEntries.splice(toOverrideIndex, 1);
              }
            }
            for (const alias of aliases) {
              entriesNameSet.add(alias);
            }
          }
          relativeEntries.push(entry);
        }, "addRelativeTo"),
        clone: /* @__PURE__ */ __name(() => cloneTo(constructStack()), "clone"),
        use: /* @__PURE__ */ __name((plugin) => {
          plugin.applyToStack(stack);
        }, "use"),
        remove: /* @__PURE__ */ __name((toRemove) => {
          if (typeof toRemove === "string")
            return removeByName(toRemove);
          else
            return removeByReference(toRemove);
        }, "remove"),
        removeByTag: /* @__PURE__ */ __name((toRemove) => {
          let isRemoved = false;
          const filterCb = /* @__PURE__ */ __name((entry) => {
            const { tags, name, aliases: _aliases } = entry;
            if (tags && tags.includes(toRemove)) {
              const aliases = getAllAliases(name, _aliases);
              for (const alias of aliases) {
                entriesNameSet.delete(alias);
              }
              isRemoved = true;
              return false;
            }
            return true;
          }, "filterCb");
          absoluteEntries = absoluteEntries.filter(filterCb);
          relativeEntries = relativeEntries.filter(filterCb);
          return isRemoved;
        }, "removeByTag"),
        concat: /* @__PURE__ */ __name((from) => {
          const cloned = cloneTo(constructStack());
          cloned.use(from);
          cloned.identifyOnResolve(identifyOnResolve || cloned.identifyOnResolve() || (from.identifyOnResolve?.() ?? false));
          return cloned;
        }, "concat"),
        applyToStack: cloneTo,
        identify: /* @__PURE__ */ __name(() => {
          return getMiddlewareList(true).map((mw) => {
            const step = mw.step ?? mw.relation + " " + mw.toMiddleware;
            return getMiddlewareNameWithAliases(mw.name, mw.aliases) + " - " + step;
          });
        }, "identify"),
        identifyOnResolve(toggle) {
          if (typeof toggle === "boolean")
            identifyOnResolve = toggle;
          return identifyOnResolve;
        },
        resolve: /* @__PURE__ */ __name((handler, context) => {
          for (const middleware of getMiddlewareList().map((entry) => entry.middleware).reverse()) {
            handler = middleware(handler, context);
          }
          if (identifyOnResolve) {
            console.log(stack.identify());
          }
          return handler;
        }, "resolve")
      };
      return stack;
    }, "constructStack");
    stepWeights = {
      initialize: 5,
      serialize: 4,
      build: 3,
      finalizeRequest: 2,
      deserialize: 1
    };
    priorityWeights = {
      high: 3,
      normal: 2,
      low: 1
    };
  }
});

// node_modules/@smithy/types/dist-es/abort.js
var init_abort = __esm({
  "node_modules/@smithy/types/dist-es/abort.js"() {
  }
});

// node_modules/@smithy/types/dist-es/auth/auth.js
var HttpAuthLocation;
var init_auth = __esm({
  "node_modules/@smithy/types/dist-es/auth/auth.js"() {
    (function(HttpAuthLocation2) {
      HttpAuthLocation2["HEADER"] = "header";
      HttpAuthLocation2["QUERY"] = "query";
    })(HttpAuthLocation || (HttpAuthLocation = {}));
  }
});

// node_modules/@smithy/types/dist-es/auth/HttpApiKeyAuth.js
var HttpApiKeyAuthLocation;
var init_HttpApiKeyAuth = __esm({
  "node_modules/@smithy/types/dist-es/auth/HttpApiKeyAuth.js"() {
    (function(HttpApiKeyAuthLocation2) {
      HttpApiKeyAuthLocation2["HEADER"] = "header";
      HttpApiKeyAuthLocation2["QUERY"] = "query";
    })(HttpApiKeyAuthLocation || (HttpApiKeyAuthLocation = {}));
  }
});

// node_modules/@smithy/types/dist-es/auth/HttpAuthScheme.js
var init_HttpAuthScheme = __esm({
  "node_modules/@smithy/types/dist-es/auth/HttpAuthScheme.js"() {
  }
});

// node_modules/@smithy/types/dist-es/auth/HttpAuthSchemeProvider.js
var init_HttpAuthSchemeProvider = __esm({
  "node_modules/@smithy/types/dist-es/auth/HttpAuthSchemeProvider.js"() {
  }
});

// node_modules/@smithy/types/dist-es/auth/HttpSigner.js
var init_HttpSigner = __esm({
  "node_modules/@smithy/types/dist-es/auth/HttpSigner.js"() {
  }
});

// node_modules/@smithy/types/dist-es/auth/IdentityProviderConfig.js
var init_IdentityProviderConfig = __esm({
  "node_modules/@smithy/types/dist-es/auth/IdentityProviderConfig.js"() {
  }
});

// node_modules/@smithy/types/dist-es/auth/index.js
var init_auth2 = __esm({
  "node_modules/@smithy/types/dist-es/auth/index.js"() {
    init_auth();
    init_HttpApiKeyAuth();
    init_HttpAuthScheme();
    init_HttpAuthSchemeProvider();
    init_HttpSigner();
    init_IdentityProviderConfig();
  }
});

// node_modules/@smithy/types/dist-es/blob/blob-payload-input-types.js
var init_blob_payload_input_types = __esm({
  "node_modules/@smithy/types/dist-es/blob/blob-payload-input-types.js"() {
  }
});

// node_modules/@smithy/types/dist-es/checksum.js
var init_checksum = __esm({
  "node_modules/@smithy/types/dist-es/checksum.js"() {
  }
});

// node_modules/@smithy/types/dist-es/client.js
var init_client = __esm({
  "node_modules/@smithy/types/dist-es/client.js"() {
  }
});

// node_modules/@smithy/types/dist-es/command.js
var init_command = __esm({
  "node_modules/@smithy/types/dist-es/command.js"() {
  }
});

// node_modules/@smithy/types/dist-es/connection/config.js
var init_config = __esm({
  "node_modules/@smithy/types/dist-es/connection/config.js"() {
  }
});

// node_modules/@smithy/types/dist-es/connection/manager.js
var init_manager = __esm({
  "node_modules/@smithy/types/dist-es/connection/manager.js"() {
  }
});

// node_modules/@smithy/types/dist-es/connection/pool.js
var init_pool = __esm({
  "node_modules/@smithy/types/dist-es/connection/pool.js"() {
  }
});

// node_modules/@smithy/types/dist-es/connection/index.js
var init_connection = __esm({
  "node_modules/@smithy/types/dist-es/connection/index.js"() {
    init_config();
    init_manager();
    init_pool();
  }
});

// node_modules/@smithy/types/dist-es/crypto.js
var init_crypto = __esm({
  "node_modules/@smithy/types/dist-es/crypto.js"() {
  }
});

// node_modules/@smithy/types/dist-es/encode.js
var init_encode = __esm({
  "node_modules/@smithy/types/dist-es/encode.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoint.js
var EndpointURLScheme;
var init_endpoint = __esm({
  "node_modules/@smithy/types/dist-es/endpoint.js"() {
    (function(EndpointURLScheme2) {
      EndpointURLScheme2["HTTP"] = "http";
      EndpointURLScheme2["HTTPS"] = "https";
    })(EndpointURLScheme || (EndpointURLScheme = {}));
  }
});

// node_modules/@smithy/types/dist-es/endpoints/EndpointRuleObject.js
var init_EndpointRuleObject = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/EndpointRuleObject.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoints/ErrorRuleObject.js
var init_ErrorRuleObject = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/ErrorRuleObject.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoints/RuleSetObject.js
var init_RuleSetObject = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/RuleSetObject.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoints/shared.js
var init_shared = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/shared.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoints/TreeRuleObject.js
var init_TreeRuleObject = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/TreeRuleObject.js"() {
  }
});

// node_modules/@smithy/types/dist-es/endpoints/index.js
var init_endpoints = __esm({
  "node_modules/@smithy/types/dist-es/endpoints/index.js"() {
    init_EndpointRuleObject();
    init_ErrorRuleObject();
    init_RuleSetObject();
    init_shared();
    init_TreeRuleObject();
  }
});

// node_modules/@smithy/types/dist-es/eventStream.js
var init_eventStream = __esm({
  "node_modules/@smithy/types/dist-es/eventStream.js"() {
  }
});

// node_modules/@smithy/types/dist-es/extensions/checksum.js
var AlgorithmId;
var init_checksum2 = __esm({
  "node_modules/@smithy/types/dist-es/extensions/checksum.js"() {
    (function(AlgorithmId2) {
      AlgorithmId2["MD5"] = "md5";
      AlgorithmId2["CRC32"] = "crc32";
      AlgorithmId2["CRC32C"] = "crc32c";
      AlgorithmId2["SHA1"] = "sha1";
      AlgorithmId2["SHA256"] = "sha256";
    })(AlgorithmId || (AlgorithmId = {}));
  }
});

// node_modules/@smithy/types/dist-es/extensions/defaultClientConfiguration.js
var init_defaultClientConfiguration = __esm({
  "node_modules/@smithy/types/dist-es/extensions/defaultClientConfiguration.js"() {
  }
});

// node_modules/@smithy/types/dist-es/extensions/defaultExtensionConfiguration.js
var init_defaultExtensionConfiguration = __esm({
  "node_modules/@smithy/types/dist-es/extensions/defaultExtensionConfiguration.js"() {
  }
});

// node_modules/@smithy/types/dist-es/extensions/index.js
var init_extensions = __esm({
  "node_modules/@smithy/types/dist-es/extensions/index.js"() {
    init_defaultClientConfiguration();
    init_defaultExtensionConfiguration();
    init_checksum2();
  }
});

// node_modules/@smithy/types/dist-es/feature-ids.js
var init_feature_ids = __esm({
  "node_modules/@smithy/types/dist-es/feature-ids.js"() {
  }
});

// node_modules/@smithy/types/dist-es/http.js
var FieldPosition;
var init_http = __esm({
  "node_modules/@smithy/types/dist-es/http.js"() {
    (function(FieldPosition2) {
      FieldPosition2[FieldPosition2["HEADER"] = 0] = "HEADER";
      FieldPosition2[FieldPosition2["TRAILER"] = 1] = "TRAILER";
    })(FieldPosition || (FieldPosition = {}));
  }
});

// node_modules/@smithy/types/dist-es/http/httpHandlerInitialization.js
var init_httpHandlerInitialization = __esm({
  "node_modules/@smithy/types/dist-es/http/httpHandlerInitialization.js"() {
  }
});

// node_modules/@smithy/types/dist-es/identity/apiKeyIdentity.js
var init_apiKeyIdentity = __esm({
  "node_modules/@smithy/types/dist-es/identity/apiKeyIdentity.js"() {
  }
});

// node_modules/@smithy/types/dist-es/identity/awsCredentialIdentity.js
var init_awsCredentialIdentity = __esm({
  "node_modules/@smithy/types/dist-es/identity/awsCredentialIdentity.js"() {
  }
});

// node_modules/@smithy/types/dist-es/identity/identity.js
var init_identity = __esm({
  "node_modules/@smithy/types/dist-es/identity/identity.js"() {
  }
});

// node_modules/@smithy/types/dist-es/identity/tokenIdentity.js
var init_tokenIdentity = __esm({
  "node_modules/@smithy/types/dist-es/identity/tokenIdentity.js"() {
  }
});

// node_modules/@smithy/types/dist-es/identity/index.js
var init_identity2 = __esm({
  "node_modules/@smithy/types/dist-es/identity/index.js"() {
    init_apiKeyIdentity();
    init_awsCredentialIdentity();
    init_identity();
    init_tokenIdentity();
  }
});

// node_modules/@smithy/types/dist-es/logger.js
var init_logger = __esm({
  "node_modules/@smithy/types/dist-es/logger.js"() {
  }
});

// node_modules/@smithy/types/dist-es/middleware.js
var SMITHY_CONTEXT_KEY;
var init_middleware = __esm({
  "node_modules/@smithy/types/dist-es/middleware.js"() {
    SMITHY_CONTEXT_KEY = "__smithy_context";
  }
});

// node_modules/@smithy/types/dist-es/pagination.js
var init_pagination = __esm({
  "node_modules/@smithy/types/dist-es/pagination.js"() {
  }
});

// node_modules/@smithy/types/dist-es/profile.js
var IniSectionType;
var init_profile = __esm({
  "node_modules/@smithy/types/dist-es/profile.js"() {
    (function(IniSectionType2) {
      IniSectionType2["PROFILE"] = "profile";
      IniSectionType2["SSO_SESSION"] = "sso-session";
      IniSectionType2["SERVICES"] = "services";
    })(IniSectionType || (IniSectionType = {}));
  }
});

// node_modules/@smithy/types/dist-es/response.js
var init_response = __esm({
  "node_modules/@smithy/types/dist-es/response.js"() {
  }
});

// node_modules/@smithy/types/dist-es/retry.js
var init_retry = __esm({
  "node_modules/@smithy/types/dist-es/retry.js"() {
  }
});

// node_modules/@smithy/types/dist-es/schema/schema.js
var init_schema = __esm({
  "node_modules/@smithy/types/dist-es/schema/schema.js"() {
  }
});

// node_modules/@smithy/types/dist-es/schema/traits.js
var init_traits = __esm({
  "node_modules/@smithy/types/dist-es/schema/traits.js"() {
  }
});

// node_modules/@smithy/types/dist-es/schema/schema-deprecated.js
var init_schema_deprecated = __esm({
  "node_modules/@smithy/types/dist-es/schema/schema-deprecated.js"() {
  }
});

// node_modules/@smithy/types/dist-es/schema/sentinels.js
var init_sentinels = __esm({
  "node_modules/@smithy/types/dist-es/schema/sentinels.js"() {
  }
});

// node_modules/@smithy/types/dist-es/schema/static-schemas.js
var init_static_schemas = __esm({
  "node_modules/@smithy/types/dist-es/schema/static-schemas.js"() {
  }
});

// node_modules/@smithy/types/dist-es/serde.js
var init_serde = __esm({
  "node_modules/@smithy/types/dist-es/serde.js"() {
  }
});

// node_modules/@smithy/types/dist-es/shapes.js
var init_shapes = __esm({
  "node_modules/@smithy/types/dist-es/shapes.js"() {
  }
});

// node_modules/@smithy/types/dist-es/signature.js
var init_signature = __esm({
  "node_modules/@smithy/types/dist-es/signature.js"() {
  }
});

// node_modules/@smithy/types/dist-es/stream.js
var init_stream = __esm({
  "node_modules/@smithy/types/dist-es/stream.js"() {
  }
});

// node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-common-types.js
var init_streaming_blob_common_types = __esm({
  "node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-common-types.js"() {
  }
});

// node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-payload-input-types.js
var init_streaming_blob_payload_input_types = __esm({
  "node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-payload-input-types.js"() {
  }
});

// node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-payload-output-types.js
var init_streaming_blob_payload_output_types = __esm({
  "node_modules/@smithy/types/dist-es/streaming-payload/streaming-blob-payload-output-types.js"() {
  }
});

// node_modules/@smithy/types/dist-es/transfer.js
var RequestHandlerProtocol;
var init_transfer = __esm({
  "node_modules/@smithy/types/dist-es/transfer.js"() {
    (function(RequestHandlerProtocol2) {
      RequestHandlerProtocol2["HTTP_0_9"] = "http/0.9";
      RequestHandlerProtocol2["HTTP_1_0"] = "http/1.0";
      RequestHandlerProtocol2["TDS_8_0"] = "tds/8.0";
    })(RequestHandlerProtocol || (RequestHandlerProtocol = {}));
  }
});

// node_modules/@smithy/types/dist-es/transform/client-payload-blob-type-narrow.js
var init_client_payload_blob_type_narrow = __esm({
  "node_modules/@smithy/types/dist-es/transform/client-payload-blob-type-narrow.js"() {
  }
});

// node_modules/@smithy/types/dist-es/transform/mutable.js
var init_mutable = __esm({
  "node_modules/@smithy/types/dist-es/transform/mutable.js"() {
  }
});

// node_modules/@smithy/types/dist-es/transform/no-undefined.js
var init_no_undefined = __esm({
  "node_modules/@smithy/types/dist-es/transform/no-undefined.js"() {
  }
});

// node_modules/@smithy/types/dist-es/transform/type-transform.js
var init_type_transform = __esm({
  "node_modules/@smithy/types/dist-es/transform/type-transform.js"() {
  }
});

// node_modules/@smithy/types/dist-es/uri.js
var init_uri = __esm({
  "node_modules/@smithy/types/dist-es/uri.js"() {
  }
});

// node_modules/@smithy/types/dist-es/util.js
var init_util = __esm({
  "node_modules/@smithy/types/dist-es/util.js"() {
  }
});

// node_modules/@smithy/types/dist-es/waiter.js
var init_waiter = __esm({
  "node_modules/@smithy/types/dist-es/waiter.js"() {
  }
});

// node_modules/@smithy/types/dist-es/index.js
var init_dist_es = __esm({
  "node_modules/@smithy/types/dist-es/index.js"() {
    init_abort();
    init_auth2();
    init_blob_payload_input_types();
    init_checksum();
    init_client();
    init_command();
    init_connection();
    init_crypto();
    init_encode();
    init_endpoint();
    init_endpoints();
    init_eventStream();
    init_extensions();
    init_feature_ids();
    init_http();
    init_httpHandlerInitialization();
    init_identity2();
    init_logger();
    init_middleware();
    init_pagination();
    init_profile();
    init_response();
    init_retry();
    init_schema();
    init_traits();
    init_schema_deprecated();
    init_sentinels();
    init_static_schemas();
    init_serde();
    init_shapes();
    init_signature();
    init_stream();
    init_streaming_blob_common_types();
    init_streaming_blob_payload_input_types();
    init_streaming_blob_payload_output_types();
    init_transfer();
    init_client_payload_blob_type_narrow();
    init_mutable();
    init_no_undefined();
    init_type_transform();
    init_uri();
    init_util();
    init_waiter();
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/util-middleware/getSmithyContext.js
var getSmithyContext;
var init_getSmithyContext = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/util-middleware/getSmithyContext.js"() {
    init_dist_es();
    getSmithyContext = /* @__PURE__ */ __name((context) => context[SMITHY_CONTEXT_KEY] || (context[SMITHY_CONTEXT_KEY] = {}), "getSmithyContext");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/util-middleware/normalizeProvider.js
var normalizeProvider;
var init_normalizeProvider = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/util-middleware/normalizeProvider.js"() {
    normalizeProvider = /* @__PURE__ */ __name((input) => {
      if (typeof input === "function")
        return input;
      const promisified = Promise.resolve(input);
      return () => promisified;
    }, "normalizeProvider");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/invalid-dependency/invalidProvider.js
var invalidProvider;
var init_invalidProvider = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/invalid-dependency/invalidProvider.js"() {
    invalidProvider = /* @__PURE__ */ __name((message) => () => Promise.reject(message), "invalidProvider");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/client.js
var Client;
var init_client2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/client.js"() {
    init_MiddlewareStack();
    Client = class {
      static {
        __name(this, "Client");
      }
      config;
      middlewareStack = constructStack();
      initConfig;
      handlers;
      constructor(config) {
        this.config = config;
        const { protocol, protocolSettings } = config;
        if (protocolSettings) {
          if (typeof protocol === "function") {
            config.protocol = new protocol(protocolSettings);
          }
        }
      }
      send(command, optionsOrCb, cb) {
        const options = typeof optionsOrCb !== "function" ? optionsOrCb : void 0;
        const callback = typeof optionsOrCb === "function" ? optionsOrCb : cb;
        const useHandlerCache = options === void 0 && this.config.cacheMiddleware === true;
        let handler;
        if (useHandlerCache) {
          if (!this.handlers) {
            this.handlers = /* @__PURE__ */ new WeakMap();
          }
          const handlers = this.handlers;
          if (handlers.has(command.constructor)) {
            handler = handlers.get(command.constructor);
          } else {
            handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
            handlers.set(command.constructor, handler);
          }
        } else {
          delete this.handlers;
          handler = command.resolveMiddleware(this.middlewareStack, this.config, options);
        }
        if (callback) {
          handler(command).then((result) => callback(null, result.output), (err) => callback(err)).catch(() => {
          });
        } else {
          return handler(command).then((result) => result.output);
        }
      }
      destroy() {
        this.config?.requestHandler?.destroy?.();
        delete this.handlers;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/deref.js
var deref;
var init_deref = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/deref.js"() {
    deref = /* @__PURE__ */ __name((schemaRef) => {
      if (typeof schemaRef === "function") {
        return schemaRef();
      }
      return schemaRef;
    }, "deref");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-base64/constants-for-browser.js
var chars, alphabetByEncoding, alphabetByValue, bitsPerLetter, bitsPerByte, maxLetterValue;
var init_constants_for_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-base64/constants-for-browser.js"() {
    chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`;
    alphabetByEncoding = Object.entries(chars).reduce((acc, [i2, c2]) => {
      acc[c2] = Number(i2);
      return acc;
    }, {});
    alphabetByValue = chars.split("");
    bitsPerLetter = 6;
    bitsPerByte = 8;
    maxLetterValue = 63;
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-base64/fromBase64.browser.js
var fromBase64;
var init_fromBase64_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-base64/fromBase64.browser.js"() {
    init_constants_for_browser();
    fromBase64 = /* @__PURE__ */ __name((input) => {
      let totalByteLength = input.length / 4 * 3;
      if (input.slice(-2) === "==") {
        totalByteLength -= 2;
      } else if (input.slice(-1) === "=") {
        totalByteLength--;
      }
      const out = new ArrayBuffer(totalByteLength);
      const dataView = new DataView(out);
      for (let i2 = 0; i2 < input.length; i2 += 4) {
        let bits = 0;
        let bitLength = 0;
        for (let j2 = i2, limit = i2 + 3; j2 <= limit; j2++) {
          if (input[j2] !== "=") {
            if (!(input[j2] in alphabetByEncoding)) {
              throw new TypeError(`Invalid character ${input[j2]} in base64 string.`);
            }
            bits |= alphabetByEncoding[input[j2]] << (limit - j2) * bitsPerLetter;
            bitLength += bitsPerLetter;
          } else {
            bits >>= bitsPerLetter;
          }
        }
        const chunkOffset = i2 / 4 * 3;
        bits >>= bitLength % bitsPerByte;
        const byteLength = Math.floor(bitLength / bitsPerByte);
        for (let k2 = 0; k2 < byteLength; k2++) {
          const offset = (byteLength - k2 - 1) * bitsPerByte;
          dataView.setUint8(chunkOffset + k2, (bits & 255 << offset) >> offset);
        }
      }
      return new Uint8Array(out);
    }, "fromBase64");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/fromUtf8.browser.js
var fromUtf8;
var init_fromUtf8_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/fromUtf8.browser.js"() {
    fromUtf8 = /* @__PURE__ */ __name((input) => new TextEncoder().encode(input), "fromUtf8");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-base64/toBase64.browser.js
function toBase64(_input) {
  let input;
  if (typeof _input === "string") {
    input = fromUtf8(_input);
  } else {
    input = _input;
  }
  const isArrayLike = typeof input === "object" && typeof input.length === "number";
  const isUint8Array = typeof input === "object" && typeof input.byteOffset === "number" && typeof input.byteLength === "number";
  if (!isArrayLike && !isUint8Array) {
    throw new Error("@smithy/util-base64: toBase64 encoder function only accepts string | Uint8Array.");
  }
  let str = "";
  for (let i2 = 0; i2 < input.length; i2 += 3) {
    let bits = 0;
    let bitLength = 0;
    for (let j2 = i2, limit = Math.min(i2 + 3, input.length); j2 < limit; j2++) {
      bits |= input[j2] << (limit - j2 - 1) * bitsPerByte;
      bitLength += bitsPerByte;
    }
    const bitClusterCount = Math.ceil(bitLength / bitsPerLetter);
    bits <<= bitClusterCount * bitsPerLetter - bitLength;
    for (let k2 = 1; k2 <= bitClusterCount; k2++) {
      const offset = (bitClusterCount - k2) * bitsPerLetter;
      str += alphabetByValue[(bits & maxLetterValue << offset) >> offset];
    }
    str += "==".slice(0, 4 - bitClusterCount);
  }
  return str;
}
var init_toBase64_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-base64/toBase64.browser.js"() {
    init_fromUtf8_browser();
    init_constants_for_browser();
    __name(toBase64, "toBase64");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/blob/Uint8ArrayBlobAdapter.js
function bindUint8ArrayBlobAdapter(toUtf82, fromUtf84, toBase642, fromBase642) {
  return class Uint8ArrayBlobAdapter2 extends Uint8Array {
    static {
      __name(this, "Uint8ArrayBlobAdapter");
    }
    static fromString(source, encoding = "utf-8") {
      if (typeof source === "string") {
        if (encoding === "base64") {
          return Uint8ArrayBlobAdapter2.mutate(fromBase642(source));
        }
        return Uint8ArrayBlobAdapter2.mutate(fromUtf84(source));
      }
      throw new Error(`Unsupported conversion from ${typeof source} to Uint8ArrayBlobAdapter.`);
    }
    static mutate(source) {
      Object.setPrototypeOf(source, Uint8ArrayBlobAdapter2.prototype);
      return source;
    }
    transformToString(encoding = "utf-8") {
      if (encoding === "base64") {
        return toBase642(this);
      }
      return toUtf82(this);
    }
  };
}
var init_Uint8ArrayBlobAdapter = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/blob/Uint8ArrayBlobAdapter.js"() {
    __name(bindUint8ArrayBlobAdapter, "bindUint8ArrayBlobAdapter");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/toUtf8.browser.js
var toUtf8;
var init_toUtf8_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/toUtf8.browser.js"() {
    toUtf8 = /* @__PURE__ */ __name((input) => {
      if (typeof input === "string") {
        return input;
      }
      if (typeof input !== "object" || typeof input.byteOffset !== "number" || typeof input.byteLength !== "number") {
        throw new Error("@smithy/util-utf8: toUtf8 encoder function only accepts string | Uint8Array.");
      }
      return new TextDecoder("utf-8").decode(input);
    }, "toUtf8");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/uuid/v4.js
function bindV4(getRandomValues) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return () => crypto.randomUUID();
  }
  return () => {
    const rnds = new Uint8Array(16);
    getRandomValues(rnds);
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    return decimalToHex[rnds[0]] + decimalToHex[rnds[1]] + decimalToHex[rnds[2]] + decimalToHex[rnds[3]] + "-" + decimalToHex[rnds[4]] + decimalToHex[rnds[5]] + "-" + decimalToHex[rnds[6]] + decimalToHex[rnds[7]] + "-" + decimalToHex[rnds[8]] + decimalToHex[rnds[9]] + "-" + decimalToHex[rnds[10]] + decimalToHex[rnds[11]] + decimalToHex[rnds[12]] + decimalToHex[rnds[13]] + decimalToHex[rnds[14]] + decimalToHex[rnds[15]];
  };
}
var decimalToHex;
var init_v4 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/uuid/v4.js"() {
    decimalToHex = Array.from({ length: 256 }, (_, i2) => i2.toString(16).padStart(2, "0"));
    __name(bindV4, "bindV4");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/parse-utils.js
var expectNumber, MAX_FLOAT, expectFloat32, expectLong, expectShort, expectByte, expectSizedInt, castInt, strictParseFloat32, NUMBER_REGEX, parseNumber, strictParseShort, strictParseByte, stackTraceWarning, logger;
var init_parse_utils = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/parse-utils.js"() {
    expectNumber = /* @__PURE__ */ __name((value) => {
      if (value === null || value === void 0) {
        return void 0;
      }
      if (typeof value === "string") {
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
          if (String(parsed) !== String(value)) {
            logger.warn(stackTraceWarning(`Expected number but observed string: ${value}`));
          }
          return parsed;
        }
      }
      if (typeof value === "number") {
        return value;
      }
      throw new TypeError(`Expected number, got ${typeof value}: ${value}`);
    }, "expectNumber");
    MAX_FLOAT = Math.ceil(2 ** 127 * (2 - 2 ** -23));
    expectFloat32 = /* @__PURE__ */ __name((value) => {
      const expected = expectNumber(value);
      if (expected !== void 0 && !Number.isNaN(expected) && expected !== Infinity && expected !== -Infinity) {
        if (Math.abs(expected) > MAX_FLOAT) {
          throw new TypeError(`Expected 32-bit float, got ${value}`);
        }
      }
      return expected;
    }, "expectFloat32");
    expectLong = /* @__PURE__ */ __name((value) => {
      if (value === null || value === void 0) {
        return void 0;
      }
      if (Number.isInteger(value) && !Number.isNaN(value)) {
        return value;
      }
      throw new TypeError(`Expected integer, got ${typeof value}: ${value}`);
    }, "expectLong");
    expectShort = /* @__PURE__ */ __name((value) => expectSizedInt(value, 16), "expectShort");
    expectByte = /* @__PURE__ */ __name((value) => expectSizedInt(value, 8), "expectByte");
    expectSizedInt = /* @__PURE__ */ __name((value, size) => {
      const expected = expectLong(value);
      if (expected !== void 0 && castInt(expected, size) !== expected) {
        throw new TypeError(`Expected ${size}-bit integer, got ${value}`);
      }
      return expected;
    }, "expectSizedInt");
    castInt = /* @__PURE__ */ __name((value, size) => {
      switch (size) {
        case 32:
          return Int32Array.of(value)[0];
        case 16:
          return Int16Array.of(value)[0];
        case 8:
          return Int8Array.of(value)[0];
      }
    }, "castInt");
    strictParseFloat32 = /* @__PURE__ */ __name((value) => {
      if (typeof value == "string") {
        return expectFloat32(parseNumber(value));
      }
      return expectFloat32(value);
    }, "strictParseFloat32");
    NUMBER_REGEX = /(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|(-?Infinity)|(NaN)/g;
    parseNumber = /* @__PURE__ */ __name((value) => {
      const matches = value.match(NUMBER_REGEX);
      if (matches === null || matches[0].length !== value.length) {
        throw new TypeError(`Expected real number, got implicit NaN`);
      }
      return parseFloat(value);
    }, "parseNumber");
    strictParseShort = /* @__PURE__ */ __name((value) => {
      if (typeof value === "string") {
        return expectShort(parseNumber(value));
      }
      return expectShort(value);
    }, "strictParseShort");
    strictParseByte = /* @__PURE__ */ __name((value) => {
      if (typeof value === "string") {
        return expectByte(parseNumber(value));
      }
      return expectByte(value);
    }, "strictParseByte");
    stackTraceWarning = /* @__PURE__ */ __name((message) => {
      return String(new TypeError(message).stack || message).split("\n").slice(0, 5).filter((s2) => !s2.includes("stackTraceWarning")).join("\n");
    }, "stackTraceWarning");
    logger = {
      warn: console.warn
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/date-utils.js
function dateToUtcString(date2) {
  const year2 = date2.getUTCFullYear();
  const month = date2.getUTCMonth();
  const dayOfWeek = date2.getUTCDay();
  const dayOfMonthInt = date2.getUTCDate();
  const hoursInt = date2.getUTCHours();
  const minutesInt = date2.getUTCMinutes();
  const secondsInt = date2.getUTCSeconds();
  const dayOfMonthString = dayOfMonthInt < 10 ? `0${dayOfMonthInt}` : `${dayOfMonthInt}`;
  const hoursString = hoursInt < 10 ? `0${hoursInt}` : `${hoursInt}`;
  const minutesString = minutesInt < 10 ? `0${minutesInt}` : `${minutesInt}`;
  const secondsString = secondsInt < 10 ? `0${secondsInt}` : `${secondsInt}`;
  return `${DAYS[dayOfWeek]}, ${dayOfMonthString} ${MONTHS[month]} ${year2} ${hoursString}:${minutesString}:${secondsString} GMT`;
}
var DAYS, MONTHS, RFC3339, RFC3339_WITH_OFFSET, IMF_FIXDATE, RFC_850_DATE, ASC_TIME, parseRfc7231DateTime, buildDate, parseTwoDigitYear, FIFTY_YEARS_IN_MILLIS, adjustRfc850Year, parseMonthByShortName, DAYS_IN_MONTH, validateDayOfMonth, isLeapYear, parseDateValue, parseMilliseconds, stripLeadingZeroes;
var init_date_utils = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/date-utils.js"() {
    init_parse_utils();
    DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    __name(dateToUtcString, "dateToUtcString");
    RFC3339 = new RegExp(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?[zZ]$/);
    RFC3339_WITH_OFFSET = new RegExp(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(([-+]\d{2}\:\d{2})|[zZ])$/);
    IMF_FIXDATE = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
    RFC_850_DATE = new RegExp(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/);
    ASC_TIME = new RegExp(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/);
    parseRfc7231DateTime = /* @__PURE__ */ __name((value) => {
      if (value === null || value === void 0) {
        return void 0;
      }
      if (typeof value !== "string") {
        throw new TypeError("RFC-7231 date-times must be expressed as strings");
      }
      let match2 = IMF_FIXDATE.exec(value);
      if (match2) {
        const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match2;
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
      }
      match2 = RFC_850_DATE.exec(value);
      if (match2) {
        const [_, dayStr, monthStr, yearStr, hours, minutes, seconds, fractionalMilliseconds] = match2;
        return adjustRfc850Year(buildDate(parseTwoDigitYear(yearStr), parseMonthByShortName(monthStr), parseDateValue(dayStr, "day", 1, 31), {
          hours,
          minutes,
          seconds,
          fractionalMilliseconds
        }));
      }
      match2 = ASC_TIME.exec(value);
      if (match2) {
        const [_, monthStr, dayStr, hours, minutes, seconds, fractionalMilliseconds, yearStr] = match2;
        return buildDate(strictParseShort(stripLeadingZeroes(yearStr)), parseMonthByShortName(monthStr), parseDateValue(dayStr.trimLeft(), "day", 1, 31), { hours, minutes, seconds, fractionalMilliseconds });
      }
      throw new TypeError("Invalid RFC-7231 date-time value");
    }, "parseRfc7231DateTime");
    buildDate = /* @__PURE__ */ __name((year2, month, day, time2) => {
      const adjustedMonth = month - 1;
      validateDayOfMonth(year2, adjustedMonth, day);
      return new Date(Date.UTC(year2, adjustedMonth, day, parseDateValue(time2.hours, "hour", 0, 23), parseDateValue(time2.minutes, "minute", 0, 59), parseDateValue(time2.seconds, "seconds", 0, 60), parseMilliseconds(time2.fractionalMilliseconds)));
    }, "buildDate");
    parseTwoDigitYear = /* @__PURE__ */ __name((value) => {
      const thisYear = (/* @__PURE__ */ new Date()).getUTCFullYear();
      const valueInThisCentury = Math.floor(thisYear / 100) * 100 + strictParseShort(stripLeadingZeroes(value));
      if (valueInThisCentury < thisYear) {
        return valueInThisCentury + 100;
      }
      return valueInThisCentury;
    }, "parseTwoDigitYear");
    FIFTY_YEARS_IN_MILLIS = 50 * 365 * 24 * 60 * 60 * 1e3;
    adjustRfc850Year = /* @__PURE__ */ __name((input) => {
      if (input.getTime() - (/* @__PURE__ */ new Date()).getTime() > FIFTY_YEARS_IN_MILLIS) {
        return new Date(Date.UTC(input.getUTCFullYear() - 100, input.getUTCMonth(), input.getUTCDate(), input.getUTCHours(), input.getUTCMinutes(), input.getUTCSeconds(), input.getUTCMilliseconds()));
      }
      return input;
    }, "adjustRfc850Year");
    parseMonthByShortName = /* @__PURE__ */ __name((value) => {
      const monthIdx = MONTHS.indexOf(value);
      if (monthIdx < 0) {
        throw new TypeError(`Invalid month: ${value}`);
      }
      return monthIdx + 1;
    }, "parseMonthByShortName");
    DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    validateDayOfMonth = /* @__PURE__ */ __name((year2, month, day) => {
      let maxDays = DAYS_IN_MONTH[month];
      if (month === 1 && isLeapYear(year2)) {
        maxDays = 29;
      }
      if (day > maxDays) {
        throw new TypeError(`Invalid day for ${MONTHS[month]} in ${year2}: ${day}`);
      }
    }, "validateDayOfMonth");
    isLeapYear = /* @__PURE__ */ __name((year2) => {
      return year2 % 4 === 0 && (year2 % 100 !== 0 || year2 % 400 === 0);
    }, "isLeapYear");
    parseDateValue = /* @__PURE__ */ __name((value, type, lower, upper) => {
      const dateVal = strictParseByte(stripLeadingZeroes(value));
      if (dateVal < lower || dateVal > upper) {
        throw new TypeError(`${type} must be between ${lower} and ${upper}, inclusive`);
      }
      return dateVal;
    }, "parseDateValue");
    parseMilliseconds = /* @__PURE__ */ __name((value) => {
      if (value === null || value === void 0) {
        return 0;
      }
      return strictParseFloat32("0." + value) * 1e3;
    }, "parseMilliseconds");
    stripLeadingZeroes = /* @__PURE__ */ __name((value) => {
      let idx = 0;
      while (idx < value.length - 1 && value.charAt(idx) === "0") {
        idx++;
      }
      if (idx === 0) {
        return value;
      }
      return value.slice(idx);
    }, "stripLeadingZeroes");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/lazy-json.js
var LazyJsonString;
var init_lazy_json = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/lazy-json.js"() {
    LazyJsonString = /* @__PURE__ */ __name(function LazyJsonString2(val) {
      const str = Object.assign(new String(val), {
        deserializeJSON() {
          return JSON.parse(String(val));
        },
        toString() {
          return String(val);
        },
        toJSON() {
          return String(val);
        }
      });
      return str;
    }, "LazyJsonString");
    LazyJsonString.from = (object) => {
      if (object && typeof object === "object" && (object instanceof LazyJsonString || "deserializeJSON" in object)) {
        return object;
      } else if (typeof object === "string" || Object.getPrototypeOf(object) === String.prototype) {
        return LazyJsonString(String(object));
      }
      return LazyJsonString(JSON.stringify(object));
    };
    LazyJsonString.fromObject = LazyJsonString.from;
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/quote-header.js
function quoteHeader(part) {
  if (part.includes(",") || part.includes('"')) {
    part = `"${part.replace(/"/g, '\\"')}"`;
  }
  return part;
}
var init_quote_header = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/quote-header.js"() {
    __name(quoteHeader, "quoteHeader");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/schema-serde-lib/schema-date-utils.js
function range(v2, min, max) {
  const _v = Number(v2);
  if (_v < min || _v > max) {
    throw new Error(`Value ${_v} out of range [${min}, ${max}]`);
  }
}
var ddd, mmm, time, date, year, RFC3339_WITH_OFFSET2, IMF_FIXDATE2, RFC_850_DATE2, ASC_TIME2, months, _parseEpochTimestamp, _parseRfc3339DateTimeWithOffset, _parseRfc7231DateTime;
var init_schema_date_utils = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/schema-serde-lib/schema-date-utils.js"() {
    ddd = `(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:[ne|u?r]?s?day)?`;
    mmm = `(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)`;
    time = `(\\d?\\d):(\\d{2}):(\\d{2})(?:\\.(\\d+))?`;
    date = `(\\d?\\d)`;
    year = `(\\d{4})`;
    RFC3339_WITH_OFFSET2 = new RegExp(/^(\d{4})-(\d\d)-(\d\d)[tT](\d\d):(\d\d):(\d\d)(\.(\d+))?(([-+]\d\d:\d\d)|[zZ])$/);
    IMF_FIXDATE2 = new RegExp(`^${ddd}, ${date} ${mmm} ${year} ${time} GMT$`);
    RFC_850_DATE2 = new RegExp(`^${ddd}, ${date}-${mmm}-(\\d\\d) ${time} GMT$`);
    ASC_TIME2 = new RegExp(`^${ddd} ${mmm} ( [1-9]|\\d\\d) ${time} ${year}$`);
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    _parseEpochTimestamp = /* @__PURE__ */ __name((value) => {
      if (value == null) {
        return void 0;
      }
      let num = NaN;
      if (typeof value === "number") {
        num = value;
      } else if (typeof value === "string") {
        if (!/^-?\d*\.?\d+$/.test(value)) {
          throw new TypeError(`parseEpochTimestamp - numeric string invalid.`);
        }
        num = Number.parseFloat(value);
      } else if (typeof value === "object" && value.tag === 1) {
        num = value.value;
      }
      if (isNaN(num) || Math.abs(num) === Infinity) {
        throw new TypeError("Epoch timestamps must be valid finite numbers.");
      }
      return new Date(Math.round(num * 1e3));
    }, "_parseEpochTimestamp");
    _parseRfc3339DateTimeWithOffset = /* @__PURE__ */ __name((value) => {
      if (value == null) {
        return void 0;
      }
      if (typeof value !== "string") {
        throw new TypeError("RFC3339 timestamps must be strings");
      }
      const matches = RFC3339_WITH_OFFSET2.exec(value);
      if (!matches) {
        throw new TypeError(`Invalid RFC3339 timestamp format ${value}`);
      }
      const [, yearStr, monthStr, dayStr, hours, minutes, seconds, , ms, offsetStr] = matches;
      range(monthStr, 1, 12);
      range(dayStr, 1, 31);
      range(hours, 0, 23);
      range(minutes, 0, 59);
      range(seconds, 0, 60);
      const date2 = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), Number(hours), Number(minutes), Number(seconds), Number(ms) ? Math.round(parseFloat(`0.${ms}`) * 1e3) : 0));
      date2.setUTCFullYear(Number(yearStr));
      if (offsetStr.toUpperCase() != "Z") {
        const [, sign, offsetH, offsetM] = /([+-])(\d\d):(\d\d)/.exec(offsetStr) || [void 0, "+", 0, 0];
        const scalar = sign === "-" ? 1 : -1;
        date2.setTime(date2.getTime() + scalar * (Number(offsetH) * 60 * 60 * 1e3 + Number(offsetM) * 60 * 1e3));
      }
      return date2;
    }, "_parseRfc3339DateTimeWithOffset");
    _parseRfc7231DateTime = /* @__PURE__ */ __name((value) => {
      if (value == null) {
        return void 0;
      }
      if (typeof value !== "string") {
        throw new TypeError("RFC7231 timestamps must be strings.");
      }
      let day;
      let month;
      let year2;
      let hour;
      let minute;
      let second;
      let fraction;
      let matches;
      if (matches = IMF_FIXDATE2.exec(value)) {
        [, day, month, year2, hour, minute, second, fraction] = matches;
      } else if (matches = RFC_850_DATE2.exec(value)) {
        [, day, month, year2, hour, minute, second, fraction] = matches;
        year2 = (Number(year2) + 1900).toString();
      } else if (matches = ASC_TIME2.exec(value)) {
        [, month, day, hour, minute, second, fraction, year2] = matches;
      }
      if (year2 && second) {
        const timestamp = Date.UTC(Number(year2), months.indexOf(month), Number(day), Number(hour), Number(minute), Number(second), fraction ? Math.round(parseFloat(`0.${fraction}`) * 1e3) : 0);
        range(day, 1, 31);
        range(hour, 0, 23);
        range(minute, 0, 59);
        range(second, 0, 60);
        const date2 = new Date(timestamp);
        date2.setUTCFullYear(Number(year2));
        return date2;
      }
      throw new TypeError(`Invalid RFC7231 date-time value ${value}.`);
    }, "_parseRfc7231DateTime");
    __name(range, "range");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/split-every.js
function splitEvery(value, delimiter, numDelimiters) {
  if (numDelimiters <= 0 || !Number.isInteger(numDelimiters)) {
    throw new Error("Invalid number of delimiters (" + numDelimiters + ") for splitEvery.");
  }
  const segments = value.split(delimiter);
  if (numDelimiters === 1) {
    return segments;
  }
  const compoundSegments = [];
  let currentSegment = "";
  for (let i2 = 0; i2 < segments.length; i2++) {
    if (currentSegment === "") {
      currentSegment = segments[i2];
    } else {
      currentSegment += delimiter + segments[i2];
    }
    if ((i2 + 1) % numDelimiters === 0) {
      compoundSegments.push(currentSegment);
      currentSegment = "";
    }
  }
  if (currentSegment !== "") {
    compoundSegments.push(currentSegment);
  }
  return compoundSegments;
}
var init_split_every = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/split-every.js"() {
    __name(splitEvery, "splitEvery");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/split-header.js
var splitHeader;
var init_split_header = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/split-header.js"() {
    splitHeader = /* @__PURE__ */ __name((value) => {
      const z2 = value.length;
      const values = [];
      let withinQuotes = false;
      let prevChar = void 0;
      let anchor = 0;
      for (let i2 = 0; i2 < z2; ++i2) {
        const char = value[i2];
        switch (char) {
          case `"`:
            if (prevChar !== "\\") {
              withinQuotes = !withinQuotes;
            }
            break;
          case ",":
            if (!withinQuotes) {
              values.push(value.slice(anchor, i2));
              anchor = i2 + 1;
            }
            break;
          default:
        }
        prevChar = char;
      }
      values.push(value.slice(anchor));
      return values.map((v2) => {
        v2 = v2.trim();
        const z3 = v2.length;
        if (z3 < 2) {
          return v2;
        }
        if (v2[0] === `"` && v2[z3 - 1] === `"`) {
          v2 = v2.slice(1, z3 - 1);
        }
        return v2.replace(/\\"/g, '"');
      });
    }, "splitHeader");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/value/NumericValue.js
var format, NumericValue;
var init_NumericValue = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/value/NumericValue.js"() {
    format = /^-?\d*(\.\d+)?$/;
    NumericValue = class _NumericValue {
      static {
        __name(this, "NumericValue");
      }
      string;
      type;
      constructor(string, type) {
        this.string = string;
        this.type = type;
        if (!format.test(string)) {
          throw new Error(`@smithy/core/serde - NumericValue must only contain [0-9], at most one decimal point ".", and an optional negation prefix "-".`);
        }
      }
      toString() {
        return this.string;
      }
      static [Symbol.hasInstance](object) {
        if (!object || typeof object !== "object") {
          return false;
        }
        const _nv = object;
        return _NumericValue.prototype.isPrototypeOf(object) || _nv.type === "bigDecimal" && format.test(_nv.string);
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-hex-encoding/hex-encoding.js
function fromHex(encoded) {
  if (encoded.length % 2 !== 0) {
    throw new Error("Hex encoded strings must have an even number length");
  }
  const out = new Uint8Array(encoded.length / 2);
  for (let i2 = 0; i2 < encoded.length; i2 += 2) {
    const encodedByte = encoded.slice(i2, i2 + 2).toLowerCase();
    if (encodedByte in HEX_TO_SHORT) {
      out[i2 / 2] = HEX_TO_SHORT[encodedByte];
    } else {
      throw new Error(`Cannot decode unrecognized sequence ${encodedByte} as hexadecimal`);
    }
  }
  return out;
}
function toHex(bytes) {
  let out = "";
  for (let i2 = 0; i2 < bytes.byteLength; i2++) {
    out += SHORT_TO_HEX[bytes[i2]];
  }
  return out;
}
var SHORT_TO_HEX, HEX_TO_SHORT;
var init_hex_encoding = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-hex-encoding/hex-encoding.js"() {
    SHORT_TO_HEX = {};
    HEX_TO_SHORT = {};
    for (let i2 = 0; i2 < 256; i2++) {
      let encodedByte = i2.toString(16).toLowerCase();
      if (encodedByte.length === 1) {
        encodedByte = `0${encodedByte}`;
      }
      SHORT_TO_HEX[i2] = encodedByte;
      HEX_TO_SHORT[encodedByte] = i2;
    }
    __name(fromHex, "fromHex");
    __name(toHex, "toHex");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-body-length/calculateBodyLength.browser.js
var TEXT_ENCODER, calculateBodyLength;
var init_calculateBodyLength_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-body-length/calculateBodyLength.browser.js"() {
    TEXT_ENCODER = typeof TextEncoder == "function" ? new TextEncoder() : null;
    calculateBodyLength = /* @__PURE__ */ __name((body) => {
      if (typeof body === "string") {
        if (TEXT_ENCODER) {
          return TEXT_ENCODER.encode(body).byteLength;
        }
        let len = body.length;
        for (let i2 = len - 1; i2 >= 0; i2--) {
          const code = body.charCodeAt(i2);
          if (code > 127 && code <= 2047)
            len++;
          else if (code > 2047 && code <= 65535)
            len += 2;
          if (code >= 56320 && code <= 57343)
            i2--;
        }
        return len;
      } else if (typeof body.byteLength === "number") {
        return body.byteLength;
      } else if (typeof body.size === "number") {
        return body.size;
      }
      throw new Error(`Body Length computation failed for ${body}`);
    }, "calculateBodyLength");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/toUint8Array.browser.js
var toUint8Array;
var init_toUint8Array_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-utf8/toUint8Array.browser.js"() {
    init_fromUtf8_browser();
    toUint8Array = /* @__PURE__ */ __name((data) => {
      if (typeof data === "string") {
        return fromUtf8(data);
      }
      if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
      }
      return new Uint8Array(data);
    }, "toUint8Array");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/is-array-buffer/is-array-buffer.js
var isArrayBuffer;
var init_is_array_buffer = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/is-array-buffer/is-array-buffer.js"() {
    isArrayBuffer = /* @__PURE__ */ __name((arg) => typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer || Object.prototype.toString.call(arg) === "[object ArrayBuffer]", "isArrayBuffer");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/getEndpointFromConfig.browser.js
var getEndpointFromConfig;
var init_getEndpointFromConfig_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/getEndpointFromConfig.browser.js"() {
    getEndpointFromConfig = /* @__PURE__ */ __name(async (serviceId) => void 0, "getEndpointFromConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/service-customizations/s3.js
var resolveParamsForS3, DOMAIN_PATTERN, IP_ADDRESS_PATTERN, DOTS_PATTERN, isDnsCompatibleBucketName, isArnBucketName;
var init_s3 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/service-customizations/s3.js"() {
    resolveParamsForS3 = /* @__PURE__ */ __name(async (endpointParams) => {
      const bucket = endpointParams?.Bucket || "";
      if (typeof endpointParams.Bucket === "string") {
        endpointParams.Bucket = bucket.replace(/#/g, encodeURIComponent("#")).replace(/\?/g, encodeURIComponent("?"));
      }
      if (isArnBucketName(bucket)) {
        if (endpointParams.ForcePathStyle === true) {
          throw new Error("Path-style addressing cannot be used with ARN buckets");
        }
      } else if (!isDnsCompatibleBucketName(bucket) || bucket.indexOf(".") !== -1 && !String(endpointParams.Endpoint).startsWith("http:") || bucket.toLowerCase() !== bucket || bucket.length < 3) {
        endpointParams.ForcePathStyle = true;
      }
      if (endpointParams.DisableMultiRegionAccessPoints) {
        endpointParams.disableMultiRegionAccessPoints = true;
        endpointParams.DisableMRAP = true;
      }
      return endpointParams;
    }, "resolveParamsForS3");
    DOMAIN_PATTERN = /^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/;
    IP_ADDRESS_PATTERN = /(\d+\.){3}\d+/;
    DOTS_PATTERN = /\.\./;
    isDnsCompatibleBucketName = /* @__PURE__ */ __name((bucketName) => DOMAIN_PATTERN.test(bucketName) && !IP_ADDRESS_PATTERN.test(bucketName) && !DOTS_PATTERN.test(bucketName), "isDnsCompatibleBucketName");
    isArnBucketName = /* @__PURE__ */ __name((bucketName) => {
      const [arn, partition2, service, , , bucket] = bucketName.split(":");
      const isArn = arn === "arn" && bucketName.split(":").length >= 6;
      const isValidArn = Boolean(isArn && partition2 && service && bucket);
      if (isArn && !isValidArn) {
        throw new Error(`Invalid ARN: ${bucketName} was an invalid ARN.`);
      }
      return isValidArn;
    }, "isArnBucketName");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/service-customizations/index.js
var init_service_customizations = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/service-customizations/index.js"() {
    init_s3();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/createConfigValueProvider.js
var createConfigValueProvider;
var init_createConfigValueProvider = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/createConfigValueProvider.js"() {
    createConfigValueProvider = /* @__PURE__ */ __name((configKey, canonicalEndpointParamKey, config, isClientContextParam = false) => {
      const configProvider = /* @__PURE__ */ __name(async () => {
        let configValue;
        if (isClientContextParam) {
          const clientContextParams = config.clientContextParams;
          const nestedValue = clientContextParams?.[configKey];
          configValue = nestedValue ?? config[configKey] ?? config[canonicalEndpointParamKey];
        } else {
          configValue = config[configKey] ?? config[canonicalEndpointParamKey];
        }
        if (typeof configValue === "function") {
          return configValue();
        }
        return configValue;
      }, "configProvider");
      if (configKey === "credentialScope" || canonicalEndpointParamKey === "CredentialScope") {
        return async () => {
          const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
          const configValue = credentials?.credentialScope ?? credentials?.CredentialScope;
          return configValue;
        };
      }
      if (configKey === "accountId" || canonicalEndpointParamKey === "AccountId") {
        return async () => {
          const credentials = typeof config.credentials === "function" ? await config.credentials() : config.credentials;
          const configValue = credentials?.accountId ?? credentials?.AccountId;
          return configValue;
        };
      }
      if (configKey === "endpoint" || canonicalEndpointParamKey === "endpoint") {
        return async () => {
          if (config.isCustomEndpoint === false) {
            return void 0;
          }
          const endpoint = await configProvider();
          if (endpoint && typeof endpoint === "object") {
            if ("url" in endpoint) {
              return endpoint.url.href;
            }
            if ("hostname" in endpoint) {
              const { protocol, hostname, port, path } = endpoint;
              return `${protocol}//${hostname}${port ? ":" + port : ""}${path}`;
            }
          }
          return endpoint;
        };
      }
      return configProvider;
    }, "createConfigValueProvider");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/toEndpointV1.js
var toEndpointV1;
var init_toEndpointV1 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/toEndpointV1.js"() {
    init_protocols();
    toEndpointV1 = /* @__PURE__ */ __name((endpoint) => {
      if (typeof endpoint === "object") {
        if ("url" in endpoint) {
          const v1Endpoint = parseUrl(endpoint.url);
          if (endpoint.headers) {
            v1Endpoint.headers = {};
            for (const name in endpoint.headers) {
              v1Endpoint.headers[name.toLowerCase()] = endpoint.headers[name].join(", ");
            }
          }
          return v1Endpoint;
        }
        return endpoint;
      }
      return parseUrl(endpoint);
    }, "toEndpointV1");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/toEndpointV1.js
var init_toEndpointV12 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/toEndpointV1.js"() {
    init_toEndpointV1();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/getEndpointFromInstructions.js
function bindGetEndpointFromInstructions(getEndpointFromConfig2) {
  return async (commandInput, instructionsSupplier, clientConfig, context) => {
    if (!clientConfig.isCustomEndpoint) {
      let endpointFromConfig;
      if (clientConfig.serviceConfiguredEndpoint) {
        endpointFromConfig = await clientConfig.serviceConfiguredEndpoint();
      } else {
        endpointFromConfig = await getEndpointFromConfig2(clientConfig.serviceId);
      }
      if (endpointFromConfig) {
        clientConfig.endpoint = () => Promise.resolve(toEndpointV1(endpointFromConfig));
        clientConfig.isCustomEndpoint = true;
      }
    }
    const endpointParams = await resolveParams(commandInput, instructionsSupplier, clientConfig);
    if (typeof clientConfig.endpointProvider !== "function") {
      throw new Error("config.endpointProvider is not set.");
    }
    const endpoint = clientConfig.endpointProvider(endpointParams, context);
    if (clientConfig.isCustomEndpoint && clientConfig.endpoint) {
      const customEndpoint = await clientConfig.endpoint();
      if (customEndpoint?.headers) {
        endpoint.headers ??= {};
        for (const [name, value] of Object.entries(customEndpoint.headers)) {
          endpoint.headers[name] = Array.isArray(value) ? value : [value];
        }
      }
    }
    return endpoint;
  };
}
var resolveParams;
var init_getEndpointFromInstructions = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/adaptors/getEndpointFromInstructions.js"() {
    init_service_customizations();
    init_createConfigValueProvider();
    init_toEndpointV12();
    __name(bindGetEndpointFromInstructions, "bindGetEndpointFromInstructions");
    resolveParams = /* @__PURE__ */ __name(async (commandInput, instructionsSupplier, clientConfig) => {
      const endpointParams = {};
      const instructions = instructionsSupplier?.getEndpointParameterInstructions?.() || {};
      for (const [name, instruction] of Object.entries(instructions)) {
        switch (instruction.type) {
          case "staticContextParams":
            endpointParams[name] = instruction.value;
            break;
          case "contextParams":
            endpointParams[name] = commandInput[instruction.name];
            break;
          case "clientContextParams":
          case "builtInParams":
            endpointParams[name] = await createConfigValueProvider(instruction.name, name, clientConfig, instruction.type !== "builtInParams")();
            break;
          case "operationContextParams":
            endpointParams[name] = instruction.get(commandInput);
            break;
          default:
            throw new Error("Unrecognized endpoint parameter instruction: " + JSON.stringify(instruction));
        }
      }
      if (Object.keys(instructions).length === 0) {
        Object.assign(endpointParams, clientConfig);
      }
      if (String(clientConfig.serviceId).toLowerCase() === "s3") {
        await resolveParamsForS3(endpointParams);
      }
      return endpointParams;
    }, "resolveParams");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/endpointMiddleware.js
function setFeature(context, feature, value) {
  if (!context.__smithy_context) {
    context.__smithy_context = { features: {} };
  } else if (!context.__smithy_context.features) {
    context.__smithy_context.features = {};
  }
  context.__smithy_context.features[feature] = value;
}
function bindEndpointMiddleware(getEndpointFromConfig2) {
  const getEndpointFromInstructions2 = bindGetEndpointFromInstructions(getEndpointFromConfig2);
  return ({ config, instructions }) => {
    return (next, context) => async (args) => {
      if (config.isCustomEndpoint) {
        setFeature(context, "ENDPOINT_OVERRIDE", "N");
      }
      const endpoint = await getEndpointFromInstructions2(args.input, {
        getEndpointParameterInstructions() {
          return instructions;
        }
      }, { ...config }, context);
      context.endpointV2 = endpoint;
      context.authSchemes = endpoint.properties?.authSchemes;
      const authScheme = context.authSchemes?.[0];
      if (authScheme) {
        context["signing_region"] = authScheme.signingRegion;
        context["signing_service"] = authScheme.signingName;
        const smithyContext = getSmithyContext(context);
        const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;
        if (httpAuthOption) {
          httpAuthOption.signingProperties = Object.assign(httpAuthOption.signingProperties || {}, {
            signing_region: authScheme.signingRegion,
            signingRegion: authScheme.signingRegion,
            signing_service: authScheme.signingName,
            signingName: authScheme.signingName,
            signingRegionSet: authScheme.signingRegionSet
          }, authScheme.properties);
        }
      }
      return next({
        ...args
      });
    };
  };
}
var init_endpointMiddleware = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/endpointMiddleware.js"() {
    init_client3();
    init_getEndpointFromInstructions();
    __name(setFeature, "setFeature");
    __name(bindEndpointMiddleware, "bindEndpointMiddleware");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/getEndpointPlugin.js
function bindGetEndpointPlugin(getEndpointFromConfig2) {
  const endpointMiddleware2 = bindEndpointMiddleware(getEndpointFromConfig2);
  return (config, instructions) => ({
    applyToStack: /* @__PURE__ */ __name((clientStack) => {
      clientStack.addRelativeTo(endpointMiddleware2({
        config,
        instructions
      }), endpointMiddlewareOptions);
    }, "applyToStack")
  });
}
var serializerMiddlewareOption, endpointMiddlewareOptions;
var init_getEndpointPlugin = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/getEndpointPlugin.js"() {
    init_endpointMiddleware();
    serializerMiddlewareOption = {
      name: "serializerMiddleware",
      step: "serialize",
      tags: ["SERIALIZER"],
      override: true
    };
    endpointMiddlewareOptions = {
      step: "serialize",
      tags: ["ENDPOINT_PARAMETERS", "ENDPOINT_V2", "ENDPOINT"],
      name: "endpointV2Middleware",
      override: true,
      relation: "before",
      toMiddleware: serializerMiddlewareOption.name
    };
    __name(bindGetEndpointPlugin, "bindGetEndpointPlugin");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/resolveEndpointConfig.js
function bindResolveEndpointConfig(getEndpointFromConfig2) {
  return (input) => {
    const tls = input.tls ?? true;
    const { endpoint, useDualstackEndpoint, useFipsEndpoint } = input;
    const customEndpointProvider = endpoint != null ? async () => toEndpointV1(await normalizeProvider(endpoint)()) : void 0;
    const isCustomEndpoint = !!endpoint;
    const resolvedConfig = Object.assign(input, {
      endpoint: customEndpointProvider,
      tls,
      isCustomEndpoint,
      useDualstackEndpoint: normalizeProvider(useDualstackEndpoint ?? false),
      useFipsEndpoint: normalizeProvider(useFipsEndpoint ?? false)
    });
    let configuredEndpointPromise = void 0;
    resolvedConfig.serviceConfiguredEndpoint = async () => {
      if (input.serviceId && !configuredEndpointPromise) {
        configuredEndpointPromise = getEndpointFromConfig2(input.serviceId);
      }
      return configuredEndpointPromise;
    };
    return resolvedConfig;
  };
}
var init_resolveEndpointConfig = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/middleware-endpoint/resolveEndpointConfig.js"() {
    init_client3();
    init_toEndpointV12();
    __name(bindResolveEndpointConfig, "bindResolveEndpointConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/bdd/BinaryDecisionDiagram.js
var BinaryDecisionDiagram;
var init_BinaryDecisionDiagram = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/bdd/BinaryDecisionDiagram.js"() {
    BinaryDecisionDiagram = class _BinaryDecisionDiagram {
      static {
        __name(this, "BinaryDecisionDiagram");
      }
      nodes;
      root;
      conditions;
      results;
      constructor(bdd2, root2, conditions, results) {
        this.nodes = bdd2;
        this.root = root2;
        this.conditions = conditions;
        this.results = results;
      }
      static from(bdd2, root2, conditions, results) {
        return new _BinaryDecisionDiagram(bdd2, root2, conditions, results);
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/cache/EndpointCache.js
var EndpointCache;
var init_EndpointCache = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/cache/EndpointCache.js"() {
    EndpointCache = class {
      static {
        __name(this, "EndpointCache");
      }
      capacity;
      data = /* @__PURE__ */ new Map();
      parameters = [];
      constructor({ size, params }) {
        this.capacity = size ?? 50;
        if (params) {
          this.parameters = params;
        }
      }
      get(endpointParams, resolver) {
        const key = this.hash(endpointParams);
        if (key === false) {
          return resolver();
        }
        if (!this.data.has(key)) {
          if (this.data.size > this.capacity + 10) {
            const keys = this.data.keys();
            let i2 = 0;
            while (true) {
              const { value, done } = keys.next();
              this.data.delete(value);
              if (done || ++i2 > 10) {
                break;
              }
            }
          }
          this.data.set(key, resolver());
        }
        return this.data.get(key);
      }
      size() {
        return this.data.size;
      }
      hash(endpointParams) {
        let buffer = "";
        const { parameters } = this;
        if (parameters.length === 0) {
          return false;
        }
        for (const param of parameters) {
          const val = String(endpointParams[param] ?? "");
          if (val.includes("|;")) {
            return false;
          }
          buffer += val + "|;";
        }
        return buffer;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointError.js
var EndpointError;
var init_EndpointError = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointError.js"() {
    EndpointError = class extends Error {
      static {
        __name(this, "EndpointError");
      }
      constructor(message) {
        super(message);
        this.name = "EndpointError";
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointFunctions.js
var init_EndpointFunctions = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointFunctions.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointRuleObject.js
var init_EndpointRuleObject2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/EndpointRuleObject.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/ErrorRuleObject.js
var init_ErrorRuleObject2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/ErrorRuleObject.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/RuleSetObject.js
var init_RuleSetObject2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/RuleSetObject.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/TreeRuleObject.js
var init_TreeRuleObject2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/TreeRuleObject.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/shared.js
var init_shared2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/shared.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/index.js
var init_types = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/types/index.js"() {
    init_EndpointError();
    init_EndpointFunctions();
    init_EndpointRuleObject2();
    init_ErrorRuleObject2();
    init_RuleSetObject2();
    init_TreeRuleObject2();
    init_shared2();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/debugId.js
var debugId;
var init_debugId = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/debugId.js"() {
    debugId = "endpoints";
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/toDebugString.js
function toDebugString(input) {
  if (typeof input !== "object" || input == null) {
    return input;
  }
  if ("ref" in input) {
    return `$${toDebugString(input.ref)}`;
  }
  if ("fn" in input) {
    return `${input.fn}(${(input.argv || []).map(toDebugString).join(", ")})`;
  }
  return JSON.stringify(input, null, 2);
}
var init_toDebugString = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/toDebugString.js"() {
    __name(toDebugString, "toDebugString");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/index.js
var init_debug = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/debug/index.js"() {
    init_debugId();
    init_toDebugString();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/customEndpointFunctions.js
var customEndpointFunctions;
var init_customEndpointFunctions = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/customEndpointFunctions.js"() {
    customEndpointFunctions = {};
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/booleanEquals.js
var booleanEquals;
var init_booleanEquals = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/booleanEquals.js"() {
    booleanEquals = /* @__PURE__ */ __name((value1, value2) => value1 === value2, "booleanEquals");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/coalesce.js
function coalesce(...args) {
  for (const arg of args) {
    if (arg != null) {
      return arg;
    }
  }
  return void 0;
}
var init_coalesce = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/coalesce.js"() {
    __name(coalesce, "coalesce");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/getAttrPathList.js
var getAttrPathList;
var init_getAttrPathList = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/getAttrPathList.js"() {
    init_types();
    getAttrPathList = /* @__PURE__ */ __name((path) => {
      const parts = path.split(".");
      const pathList = [];
      for (const part of parts) {
        const squareBracketIndex = part.indexOf("[");
        if (squareBracketIndex !== -1) {
          if (part.indexOf("]") !== part.length - 1) {
            throw new EndpointError(`Path: '${path}' does not end with ']'`);
          }
          const arrayIndex = part.slice(squareBracketIndex + 1, -1);
          if (Number.isNaN(parseInt(arrayIndex))) {
            throw new EndpointError(`Invalid array index: '${arrayIndex}' in path: '${path}'`);
          }
          if (squareBracketIndex !== 0) {
            pathList.push(part.slice(0, squareBracketIndex));
          }
          pathList.push(arrayIndex);
        } else {
          pathList.push(part);
        }
      }
      return pathList;
    }, "getAttrPathList");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/getAttr.js
var getAttr;
var init_getAttr = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/getAttr.js"() {
    init_types();
    init_getAttrPathList();
    getAttr = /* @__PURE__ */ __name((value, path) => getAttrPathList(path).reduce((acc, index) => {
      if (typeof acc !== "object") {
        throw new EndpointError(`Index '${index}' in '${path}' not found in '${JSON.stringify(value)}'`);
      } else if (Array.isArray(acc)) {
        const i2 = parseInt(index);
        return acc[i2 < 0 ? acc.length + i2 : i2];
      }
      return acc[index];
    }, value), "getAttr");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isSet.js
var isSet;
var init_isSet = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isSet.js"() {
    isSet = /* @__PURE__ */ __name((value) => value != null, "isSet");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isValidHostLabel.js
var VALID_HOST_LABEL_REGEX, isValidHostLabel;
var init_isValidHostLabel = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isValidHostLabel.js"() {
    VALID_HOST_LABEL_REGEX = new RegExp(`^(?!.*-$)(?!-)[a-zA-Z0-9-]{1,63}$`);
    isValidHostLabel = /* @__PURE__ */ __name((value, allowSubDomains = false) => {
      if (!allowSubDomains) {
        return VALID_HOST_LABEL_REGEX.test(value);
      }
      const labels = value.split(".");
      for (const label of labels) {
        if (!isValidHostLabel(label)) {
          return false;
        }
      }
      return true;
    }, "isValidHostLabel");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/ite.js
function ite(condition, trueValue, falseValue) {
  return condition ? trueValue : falseValue;
}
var init_ite = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/ite.js"() {
    __name(ite, "ite");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/not.js
var not;
var init_not = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/not.js"() {
    not = /* @__PURE__ */ __name((value) => !value, "not");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isIpAddress.js
var IP_V4_REGEX, isIpAddress;
var init_isIpAddress = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/isIpAddress.js"() {
    IP_V4_REGEX = new RegExp(`^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$`);
    isIpAddress = /* @__PURE__ */ __name((value) => IP_V4_REGEX.test(value) || value.startsWith("[") && value.endsWith("]"), "isIpAddress");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/parseURL.js
var DEFAULT_PORTS, parseURL;
var init_parseURL = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/parseURL.js"() {
    init_dist_es();
    init_isIpAddress();
    DEFAULT_PORTS = {
      [EndpointURLScheme.HTTP]: 80,
      [EndpointURLScheme.HTTPS]: 443
    };
    parseURL = /* @__PURE__ */ __name((value) => {
      const whatwgURL = (() => {
        try {
          if (value instanceof URL) {
            return value;
          }
          if (typeof value === "object" && "hostname" in value) {
            const { hostname: hostname2, port, protocol: protocol2 = "", path = "", query = {} } = value;
            const url = new URL(`${protocol2}//${hostname2}${port ? `:${port}` : ""}${path}`);
            url.search = Object.entries(query).map(([k2, v2]) => `${k2}=${v2}`).join("&");
            return url;
          }
          return new URL(value);
        } catch (error) {
          return null;
        }
      })();
      if (!whatwgURL) {
        console.error(`Unable to parse ${JSON.stringify(value)} as a whatwg URL.`);
        return null;
      }
      const urlString = whatwgURL.href;
      const { host, hostname, pathname, protocol, search } = whatwgURL;
      if (search) {
        return null;
      }
      const scheme = protocol.slice(0, -1);
      if (!Object.values(EndpointURLScheme).includes(scheme)) {
        return null;
      }
      const isIp = isIpAddress(hostname);
      const inputContainsDefaultPort = urlString.includes(`${host}:${DEFAULT_PORTS[scheme]}`) || typeof value === "string" && value.includes(`${host}:${DEFAULT_PORTS[scheme]}`);
      const authority = `${host}${inputContainsDefaultPort ? `:${DEFAULT_PORTS[scheme]}` : ``}`;
      return {
        scheme,
        authority,
        path: pathname,
        normalizedPath: pathname.endsWith("/") ? pathname : `${pathname}/`,
        isIp
      };
    }, "parseURL");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/split.js
function split(value, delimiter, limit) {
  if (limit === 1) {
    return [value];
  }
  if (value === "") {
    return [""];
  }
  const parts = value.split(delimiter);
  if (limit === 0) {
    return parts;
  }
  return parts.slice(0, limit - 1).concat(parts.slice(1).join(delimiter));
}
var init_split = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/split.js"() {
    __name(split, "split");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/stringEquals.js
var stringEquals;
var init_stringEquals = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/stringEquals.js"() {
    stringEquals = /* @__PURE__ */ __name((value1, value2) => value1 === value2, "stringEquals");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/substring.js
var substring;
var init_substring = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/substring.js"() {
    substring = /* @__PURE__ */ __name((input, start, stop, reverse) => {
      if (input == null || start >= stop || input.length < stop || /[^\u0000-\u007f]/.test(input)) {
        return null;
      }
      if (!reverse) {
        return input.substring(start, stop);
      }
      return input.substring(input.length - stop, input.length - start);
    }, "substring");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/uriEncode.js
var uriEncode;
var init_uriEncode = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/uriEncode.js"() {
    uriEncode = /* @__PURE__ */ __name((value) => encodeURIComponent(value).replace(/[!*'()]/g, (c2) => `%${c2.charCodeAt(0).toString(16).toUpperCase()}`), "uriEncode");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/index.js
var init_lib = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/lib/index.js"() {
    init_booleanEquals();
    init_coalesce();
    init_getAttr();
    init_isSet();
    init_isValidHostLabel();
    init_ite();
    init_not();
    init_parseURL();
    init_split();
    init_stringEquals();
    init_substring();
    init_uriEncode();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/endpointFunctions.js
var endpointFunctions;
var init_endpointFunctions = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/endpointFunctions.js"() {
    init_lib();
    endpointFunctions = {
      booleanEquals,
      coalesce,
      getAttr,
      isSet,
      isValidHostLabel,
      ite,
      not,
      parseURL,
      split,
      stringEquals,
      substring,
      uriEncode
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateTemplate.js
var evaluateTemplate;
var init_evaluateTemplate = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateTemplate.js"() {
    init_lib();
    evaluateTemplate = /* @__PURE__ */ __name((template, options) => {
      const evaluatedTemplateArr = [];
      const { referenceRecord, endpointParams } = options;
      let currentIndex = 0;
      while (currentIndex < template.length) {
        const openingBraceIndex = template.indexOf("{", currentIndex);
        if (openingBraceIndex === -1) {
          evaluatedTemplateArr.push(template.slice(currentIndex));
          break;
        }
        evaluatedTemplateArr.push(template.slice(currentIndex, openingBraceIndex));
        const closingBraceIndex = template.indexOf("}", openingBraceIndex);
        if (closingBraceIndex === -1) {
          evaluatedTemplateArr.push(template.slice(openingBraceIndex));
          break;
        }
        if (template[openingBraceIndex + 1] === "{" && template[closingBraceIndex + 1] === "}") {
          evaluatedTemplateArr.push(template.slice(openingBraceIndex + 1, closingBraceIndex));
          currentIndex = closingBraceIndex + 2;
        }
        const parameterName = template.substring(openingBraceIndex + 1, closingBraceIndex);
        if (parameterName.includes("#")) {
          const [refName, attrName] = parameterName.split("#");
          evaluatedTemplateArr.push(getAttr(referenceRecord[refName] ?? endpointParams[refName], attrName));
        } else {
          evaluatedTemplateArr.push(referenceRecord[parameterName] ?? endpointParams[parameterName]);
        }
        currentIndex = closingBraceIndex + 1;
      }
      return evaluatedTemplateArr.join("");
    }, "evaluateTemplate");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getReferenceValue.js
var getReferenceValue;
var init_getReferenceValue = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getReferenceValue.js"() {
    getReferenceValue = /* @__PURE__ */ __name(({ ref }, options) => {
      return options.referenceRecord[ref] ?? options.endpointParams[ref];
    }, "getReferenceValue");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateExpression.js
var evaluateExpression, callFunction, group;
var init_evaluateExpression = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateExpression.js"() {
    init_types();
    init_customEndpointFunctions();
    init_endpointFunctions();
    init_evaluateTemplate();
    init_getReferenceValue();
    evaluateExpression = /* @__PURE__ */ __name((obj, keyName, options) => {
      if (typeof obj === "string") {
        return evaluateTemplate(obj, options);
      } else if (obj["fn"]) {
        return group.callFunction(obj, options);
      } else if (obj["ref"]) {
        return getReferenceValue(obj, options);
      }
      throw new EndpointError(`'${keyName}': ${String(obj)} is not a string, function or reference.`);
    }, "evaluateExpression");
    callFunction = /* @__PURE__ */ __name(({ fn, argv }, options) => {
      const evaluatedArgs = Array(argv.length);
      for (let i2 = 0; i2 < evaluatedArgs.length; ++i2) {
        const arg = argv[i2];
        if (typeof arg === "boolean" || typeof arg === "number") {
          evaluatedArgs[i2] = arg;
        } else {
          evaluatedArgs[i2] = group.evaluateExpression(arg, "arg", options);
        }
      }
      const namespaceSeparatorIndex = fn.indexOf(".");
      if (namespaceSeparatorIndex !== -1) {
        const namespaceFunctions = customEndpointFunctions[fn.slice(0, namespaceSeparatorIndex)];
        const customFunction = namespaceFunctions?.[fn.slice(namespaceSeparatorIndex + 1)];
        if (typeof customFunction === "function") {
          return customFunction(...evaluatedArgs);
        }
      }
      const callable = endpointFunctions[fn];
      if (typeof callable === "function") {
        return callable(...evaluatedArgs);
      }
      throw new Error(`function ${fn} not loaded in endpointFunctions.`);
    }, "callFunction");
    group = {
      evaluateExpression,
      callFunction
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/callFunction.js
var init_callFunction = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/callFunction.js"() {
    init_evaluateExpression();
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateCondition.js
var evaluateCondition;
var init_evaluateCondition = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/evaluateCondition.js"() {
    init_debug();
    init_types();
    init_callFunction();
    evaluateCondition = /* @__PURE__ */ __name((condition, options) => {
      const { assign } = condition;
      if (assign && assign in options.referenceRecord) {
        throw new EndpointError(`'${assign}' is already defined in Reference Record.`);
      }
      const value = callFunction(condition, options);
      options.logger?.debug?.(`${debugId} evaluateCondition: ${toDebugString(condition)} = ${toDebugString(value)}`);
      const result = value === "" ? true : !!value;
      if (assign != null) {
        return { result, toAssign: { name: assign, value } };
      }
      return { result };
    }, "evaluateCondition");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointHeaders.js
var getEndpointHeaders;
var init_getEndpointHeaders = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointHeaders.js"() {
    init_types();
    init_evaluateExpression();
    getEndpointHeaders = /* @__PURE__ */ __name((headers, options) => Object.entries(headers ?? {}).reduce((acc, [headerKey, headerVal]) => {
      acc[headerKey] = headerVal.map((headerValEntry) => {
        const processedExpr = evaluateExpression(headerValEntry, "Header value entry", options);
        if (typeof processedExpr !== "string") {
          throw new EndpointError(`Header '${headerKey}' value '${processedExpr}' is not a string`);
        }
        return processedExpr;
      });
      return acc;
    }, {}), "getEndpointHeaders");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointProperties.js
var getEndpointProperties, getEndpointProperty, group2;
var init_getEndpointProperties = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointProperties.js"() {
    init_types();
    init_evaluateTemplate();
    getEndpointProperties = /* @__PURE__ */ __name((properties, options) => Object.entries(properties).reduce((acc, [propertyKey, propertyVal]) => {
      acc[propertyKey] = group2.getEndpointProperty(propertyVal, options);
      return acc;
    }, {}), "getEndpointProperties");
    getEndpointProperty = /* @__PURE__ */ __name((property, options) => {
      if (Array.isArray(property)) {
        return property.map((propertyEntry) => getEndpointProperty(propertyEntry, options));
      }
      switch (typeof property) {
        case "string":
          return evaluateTemplate(property, options);
        case "object":
          if (property === null) {
            throw new EndpointError(`Unexpected endpoint property: ${property}`);
          }
          return group2.getEndpointProperties(property, options);
        case "boolean":
          return property;
        default:
          throw new EndpointError(`Unexpected endpoint property type: ${typeof property}`);
      }
    }, "getEndpointProperty");
    group2 = {
      getEndpointProperty,
      getEndpointProperties
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointUrl.js
var getEndpointUrl;
var init_getEndpointUrl = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/utils/getEndpointUrl.js"() {
    init_types();
    init_evaluateExpression();
    getEndpointUrl = /* @__PURE__ */ __name((endpointUrl, options) => {
      const expression = evaluateExpression(endpointUrl, "Endpoint URL", options);
      if (typeof expression === "string") {
        try {
          return new URL(expression);
        } catch (error) {
          console.error(`Failed to construct URL with ${expression}`, error);
          throw error;
        }
      }
      throw new EndpointError(`Endpoint URL must be a string, got ${typeof expression}`);
    }, "getEndpointUrl");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/decideEndpoint.js
var RESULT, decideEndpoint;
var init_decideEndpoint = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/util-endpoints/decideEndpoint.js"() {
    init_types();
    init_evaluateCondition();
    init_evaluateExpression();
    init_getEndpointHeaders();
    init_getEndpointProperties();
    init_getEndpointUrl();
    RESULT = 1e8;
    decideEndpoint = /* @__PURE__ */ __name((bdd2, options) => {
      const { nodes: nodes2, root: root2, results, conditions } = bdd2;
      let ref = root2;
      const referenceRecord = {};
      const closure = {
        referenceRecord,
        endpointParams: options.endpointParams,
        logger: options.logger
      };
      while (ref !== 1 && ref !== -1 && ref < RESULT) {
        const node_i = 3 * (Math.abs(ref) - 1);
        const [condition_i, highRef, lowRef] = [nodes2[node_i], nodes2[node_i + 1], nodes2[node_i + 2]];
        const [fn, argv, assign] = conditions[condition_i];
        const evaluation = evaluateCondition({ fn, assign, argv }, closure);
        if (evaluation.toAssign) {
          const { name, value } = evaluation.toAssign;
          referenceRecord[name] = value;
        }
        ref = ref >= 0 === evaluation.result ? highRef : lowRef;
      }
      if (ref >= RESULT) {
        const result = results[ref - RESULT];
        if (result[0] === -1) {
          const [, errorExpression] = result;
          throw new EndpointError(evaluateExpression(errorExpression, "Error", closure));
        }
        const [url, properties, headers] = result;
        return {
          url: getEndpointUrl(url, closure),
          properties: getEndpointProperties(properties, closure),
          headers: getEndpointHeaders(headers ?? {}, closure)
        };
      }
      throw new EndpointError(`No matching endpoint.`);
    }, "decideEndpoint");
  }
});

// node_modules/@smithy/core/dist-es/submodules/endpoints/index.browser.js
var getEndpointFromInstructions, resolveEndpointConfig, endpointMiddleware, getEndpointPlugin;
var init_index_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/endpoints/index.browser.js"() {
    init_getEndpointFromConfig_browser();
    init_getEndpointFromInstructions();
    init_endpointMiddleware();
    init_getEndpointPlugin();
    init_resolveEndpointConfig();
    init_toEndpointV1();
    init_BinaryDecisionDiagram();
    init_EndpointCache();
    init_decideEndpoint();
    init_isIpAddress();
    init_isValidHostLabel();
    init_customEndpointFunctions();
    init_types();
    init_getEndpointFromInstructions();
    getEndpointFromInstructions = bindGetEndpointFromInstructions(getEndpointFromConfig);
    resolveEndpointConfig = bindResolveEndpointConfig(getEndpointFromConfig);
    endpointMiddleware = bindEndpointMiddleware(getEndpointFromConfig);
    getEndpointPlugin = bindGetEndpointPlugin(getEndpointFromConfig);
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/checksum/ChecksumStream.browser.js
var ReadableStreamRef, ChecksumStream;
var init_ChecksumStream_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/checksum/ChecksumStream.browser.js"() {
    ReadableStreamRef = typeof ReadableStream === "function" ? ReadableStream : function() {
    };
    ChecksumStream = class extends ReadableStreamRef {
      static {
        __name(this, "ChecksumStream");
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/stream-type-check.js
var isReadableStream;
var init_stream_type_check = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/stream-type-check.js"() {
    isReadableStream = /* @__PURE__ */ __name((stream) => typeof ReadableStream === "function" && (stream?.constructor?.name === ReadableStream.name || stream instanceof ReadableStream), "isReadableStream");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/checksum/createChecksumStream.browser.js
var createChecksumStream;
var init_createChecksumStream_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/checksum/createChecksumStream.browser.js"() {
    init_toBase64_browser();
    init_stream_type_check();
    init_ChecksumStream_browser();
    createChecksumStream = /* @__PURE__ */ __name(({ expectedChecksum, checksum, source, checksumSourceLocation, base64Encoder }) => {
      if (!isReadableStream(source)) {
        throw new Error(`@smithy/util-stream: unsupported source type ${source?.constructor?.name ?? source} in ChecksumStream.`);
      }
      const encoder = base64Encoder ?? toBase64;
      if (typeof TransformStream !== "function") {
        throw new Error("@smithy/util-stream: unable to instantiate ChecksumStream because API unavailable: ReadableStream/TransformStream.");
      }
      const transform = new TransformStream({
        start() {
        },
        async transform(chunk, controller) {
          checksum.update(chunk);
          controller.enqueue(chunk);
        },
        async flush(controller) {
          const digest = await checksum.digest();
          const received = encoder(digest);
          if (expectedChecksum !== received) {
            const error = new Error(`Checksum mismatch: expected "${expectedChecksum}" but received "${received}" in response header "${checksumSourceLocation}".`);
            controller.error(error);
          } else {
            controller.terminate();
          }
        }
      });
      source.pipeThrough(transform);
      const readable = transform.readable;
      Object.setPrototypeOf(readable, ChecksumStream.prototype);
      return readable;
    }, "createChecksumStream");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/ByteArrayCollector.js
var ByteArrayCollector;
var init_ByteArrayCollector = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/ByteArrayCollector.js"() {
    ByteArrayCollector = class {
      static {
        __name(this, "ByteArrayCollector");
      }
      allocByteArray;
      byteLength = 0;
      byteArrays = [];
      constructor(allocByteArray) {
        this.allocByteArray = allocByteArray;
      }
      push(byteArray) {
        this.byteArrays.push(byteArray);
        this.byteLength += byteArray.byteLength;
      }
      flush() {
        if (this.byteArrays.length === 1) {
          const bytes = this.byteArrays[0];
          this.reset();
          return bytes;
        }
        const aggregation = this.allocByteArray(this.byteLength);
        let cursor = 0;
        for (let i2 = 0; i2 < this.byteArrays.length; ++i2) {
          const bytes = this.byteArrays[i2];
          aggregation.set(bytes, cursor);
          cursor += bytes.byteLength;
        }
        this.reset();
        return aggregation;
      }
      reset() {
        this.byteArrays = [];
        this.byteLength = 0;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/createBufferedReadable.browser.js
function createBufferedReadableStream(upstream, size, logger2) {
  const reader = upstream.getReader();
  let streamBufferingLoggedWarning = false;
  let bytesSeen = 0;
  const buffers = ["", new ByteArrayCollector((size2) => new Uint8Array(size2))];
  let mode = -1;
  const pull = /* @__PURE__ */ __name(async (controller) => {
    const { value, done } = await reader.read();
    const chunk = value;
    if (done) {
      if (mode !== -1) {
        const remainder = flush(buffers, mode);
        if (sizeOf(remainder) > 0) {
          controller.enqueue(remainder);
        }
      }
      controller.close();
    } else {
      const chunkMode = modeOf(chunk, false);
      if (mode !== chunkMode) {
        if (mode >= 0) {
          controller.enqueue(flush(buffers, mode));
        }
        mode = chunkMode;
      }
      if (mode === -1) {
        controller.enqueue(chunk);
        return;
      }
      const chunkSize = sizeOf(chunk);
      bytesSeen += chunkSize;
      const bufferSize = sizeOf(buffers[mode]);
      if (chunkSize >= size && bufferSize === 0) {
        controller.enqueue(chunk);
      } else {
        const newSize = merge(buffers, mode, chunk);
        if (!streamBufferingLoggedWarning && bytesSeen > size * 2) {
          streamBufferingLoggedWarning = true;
          logger2?.warn(`@smithy/util-stream - stream chunk size ${chunkSize} is below threshold of ${size}, automatically buffering.`);
        }
        if (newSize >= size) {
          controller.enqueue(flush(buffers, mode));
        } else {
          await pull(controller);
        }
      }
    }
  }, "pull");
  return new ReadableStream({
    pull
  });
}
function merge(buffers, mode, chunk) {
  switch (mode) {
    case 0:
      buffers[0] += chunk;
      return sizeOf(buffers[0]);
    case 1:
    case 2:
      buffers[mode].push(chunk);
      return sizeOf(buffers[mode]);
  }
}
function flush(buffers, mode) {
  switch (mode) {
    case 0:
      const s2 = buffers[0];
      buffers[0] = "";
      return s2;
    case 1:
    case 2:
      return buffers[mode].flush();
  }
  throw new Error(`@smithy/util-stream - invalid index ${mode} given to flush()`);
}
function sizeOf(chunk) {
  return chunk?.byteLength ?? chunk?.length ?? 0;
}
function modeOf(chunk, allowBuffer = true) {
  if (allowBuffer && typeof Buffer !== "undefined" && chunk instanceof Buffer) {
    return 2;
  }
  if (chunk instanceof Uint8Array) {
    return 1;
  }
  if (typeof chunk === "string") {
    return 0;
  }
  return -1;
}
var createBufferedReadable;
var init_createBufferedReadable_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/createBufferedReadable.browser.js"() {
    init_ByteArrayCollector();
    __name(createBufferedReadableStream, "createBufferedReadableStream");
    createBufferedReadable = createBufferedReadableStream;
    __name(merge, "merge");
    __name(flush, "flush");
    __name(sizeOf, "sizeOf");
    __name(modeOf, "modeOf");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/getAwsChunkedEncodingStream.browser.js
var getAwsChunkedEncodingStream;
var init_getAwsChunkedEncodingStream_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/getAwsChunkedEncodingStream.browser.js"() {
    getAwsChunkedEncodingStream = /* @__PURE__ */ __name((readableStream, options) => {
      const { base64Encoder, bodyLengthChecker, checksumAlgorithmFn, checksumLocationName, streamHasher } = options;
      const checksumRequired = base64Encoder !== void 0 && bodyLengthChecker !== void 0 && checksumAlgorithmFn !== void 0 && checksumLocationName !== void 0 && streamHasher !== void 0;
      const digest = checksumRequired ? streamHasher(checksumAlgorithmFn, readableStream) : void 0;
      const reader = readableStream.getReader();
      return new ReadableStream({
        async pull(controller) {
          const { value, done } = await reader.read();
          if (done) {
            controller.enqueue(`0\r
`);
            if (checksumRequired) {
              const checksum = base64Encoder(await digest);
              controller.enqueue(`${checksumLocationName}:${checksum}\r
`);
              controller.enqueue(`\r
`);
            }
            controller.close();
          } else {
            controller.enqueue(`${(bodyLengthChecker(value) || 0).toString(16)}\r
${value}\r
`);
          }
        }
      });
    }, "getAwsChunkedEncodingStream");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/stream-collector.browser.js
async function collectBlob(blob) {
  const base64 = await readToBase64(blob);
  const arrayBuffer = fromBase64(base64);
  return new Uint8Array(arrayBuffer);
}
async function collectStream(stream) {
  const chunks = [];
  const reader = stream.getReader();
  let isDone = false;
  let length = 0;
  while (!isDone) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
      length += value.length;
    }
    isDone = done;
  }
  const collected = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    collected.set(chunk, offset);
    offset += chunk.length;
  }
  return collected;
}
function readToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.readyState !== 2) {
        return reject(new Error("Reader aborted too early"));
      }
      const result = reader.result ?? "";
      const commaIndex = result.indexOf(",");
      const dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
      resolve(result.substring(dataOffset));
    };
    reader.onabort = () => reject(new Error("Read aborted"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
var streamCollector;
var init_stream_collector_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/stream-collector.browser.js"() {
    init_fromBase64_browser();
    streamCollector = /* @__PURE__ */ __name(async (stream) => {
      if (typeof Blob === "function" && stream instanceof Blob || stream.constructor?.name === "Blob") {
        if (Blob.prototype.arrayBuffer !== void 0) {
          return new Uint8Array(await stream.arrayBuffer());
        }
        return collectBlob(stream);
      }
      return collectStream(stream);
    }, "streamCollector");
    __name(collectBlob, "collectBlob");
    __name(collectStream, "collectStream");
    __name(readToBase64, "readToBase64");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/util-stream/sdk-stream-mixin.browser.js
var ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED, sdkStreamMixin, isBlobInstance;
var init_sdk_stream_mixin_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/util-stream/sdk-stream-mixin.browser.js"() {
    init_toBase64_browser();
    init_hex_encoding();
    init_toUtf8_browser();
    init_stream_collector_browser();
    init_stream_type_check();
    ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED = "The stream has already been transformed.";
    sdkStreamMixin = /* @__PURE__ */ __name((stream) => {
      if (!isBlobInstance(stream) && !isReadableStream(stream)) {
        const name = stream?.__proto__?.constructor?.name || stream;
        throw new Error(`Unexpected stream implementation, expect Blob or ReadableStream, got ${name}`);
      }
      let transformed = false;
      const transformToByteArray = /* @__PURE__ */ __name(async () => {
        if (transformed) {
          throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
        }
        transformed = true;
        return await streamCollector(stream);
      }, "transformToByteArray");
      const blobToWebStream = /* @__PURE__ */ __name((blob) => {
        if (typeof blob.stream !== "function") {
          throw new Error("Cannot transform payload Blob to web stream. Please make sure the Blob.stream() is polyfilled.\nIf you are using React Native, this API is not yet supported, see: https://react-native.canny.io/feature-requests/p/fetch-streaming-body");
        }
        return blob.stream();
      }, "blobToWebStream");
      return Object.assign(stream, {
        transformToByteArray,
        transformToString: /* @__PURE__ */ __name(async (encoding) => {
          const buf = await transformToByteArray();
          if (encoding === "base64") {
            return toBase64(buf);
          } else if (encoding === "hex") {
            return toHex(buf);
          } else if (encoding === void 0 || encoding === "utf8" || encoding === "utf-8") {
            return toUtf8(buf);
          } else if (typeof TextDecoder === "function") {
            return new TextDecoder(encoding).decode(buf);
          } else {
            throw new Error("TextDecoder is not available, please make sure polyfill is provided.");
          }
        }, "transformToString"),
        transformToWebStream: /* @__PURE__ */ __name(() => {
          if (transformed) {
            throw new Error(ERR_MSG_STREAM_HAS_BEEN_TRANSFORMED);
          }
          transformed = true;
          if (isBlobInstance(stream)) {
            return blobToWebStream(stream);
          } else if (isReadableStream(stream)) {
            return stream;
          } else {
            throw new Error(`Cannot transform payload to web stream, got ${stream}`);
          }
        }, "transformToWebStream")
      });
    }, "sdkStreamMixin");
    isBlobInstance = /* @__PURE__ */ __name((stream) => typeof Blob === "function" && stream instanceof Blob, "isBlobInstance");
  }
});

// node_modules/@smithy/core/dist-es/submodules/serde/index.browser.js
var Uint8ArrayBlobAdapter, _getRandomValues, v4, generateIdempotencyToken;
var init_index_browser2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/serde/index.browser.js"() {
    init_fromBase64_browser();
    init_toBase64_browser();
    init_Uint8ArrayBlobAdapter();
    init_fromUtf8_browser();
    init_toUtf8_browser();
    init_v4();
    init_date_utils();
    init_lazy_json();
    init_quote_header();
    init_schema_date_utils();
    init_split_every();
    init_split_header();
    init_NumericValue();
    init_hex_encoding();
    init_calculateBodyLength_browser();
    init_toUint8Array_browser();
    init_is_array_buffer();
    init_createChecksumStream_browser();
    init_createBufferedReadable_browser();
    init_getAwsChunkedEncodingStream_browser();
    init_sdk_stream_mixin_browser();
    Uint8ArrayBlobAdapter = class extends bindUint8ArrayBlobAdapter(toUtf8, fromUtf8, toBase64, fromBase64) {
      static {
        __name(this, "Uint8ArrayBlobAdapter");
      }
    };
    _getRandomValues = /* @__PURE__ */ __name((array) => crypto.getRandomValues(array), "_getRandomValues");
    v4 = bindV4(_getRandomValues);
    generateIdempotencyToken = v4;
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/collect-stream-body.js
var collectBody;
var init_collect_stream_body = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/collect-stream-body.js"() {
    init_index_browser2();
    collectBody = /* @__PURE__ */ __name(async (streamBody = new Uint8Array(), context) => {
      if (streamBody instanceof Uint8Array) {
        return Uint8ArrayBlobAdapter.mutate(streamBody);
      }
      if (!streamBody) {
        return Uint8ArrayBlobAdapter.mutate(new Uint8Array());
      }
      const fromContext = context.streamCollector(streamBody);
      return Uint8ArrayBlobAdapter.mutate(await fromContext);
    }, "collectBody");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/extended-encode-uri-component.js
function extendedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c2) {
    return "%" + c2.charCodeAt(0).toString(16).toUpperCase();
  });
}
var init_extended_encode_uri_component = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/extended-encode-uri-component.js"() {
    __name(extendedEncodeURIComponent, "extendedEncodeURIComponent");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/SerdeContext.js
var SerdeContext;
var init_SerdeContext = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/SerdeContext.js"() {
    SerdeContext = class {
      static {
        __name(this, "SerdeContext");
      }
      serdeContext;
      setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/httpRequest.js
function cloneQuery(query) {
  return Object.keys(query).reduce((carry, paramName) => {
    const param = query[paramName];
    return {
      ...carry,
      [paramName]: Array.isArray(param) ? [...param] : param
    };
  }, {});
}
var HttpRequest;
var init_httpRequest = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/httpRequest.js"() {
    HttpRequest = class _HttpRequest {
      static {
        __name(this, "HttpRequest");
      }
      method;
      protocol;
      hostname;
      port;
      path;
      query;
      headers;
      username;
      password;
      fragment;
      body;
      constructor(options) {
        this.method = options.method || "GET";
        this.hostname = options.hostname || "localhost";
        this.port = options.port;
        this.query = options.query || {};
        this.headers = options.headers || {};
        this.body = options.body;
        this.protocol = options.protocol ? options.protocol.slice(-1) !== ":" ? `${options.protocol}:` : options.protocol : "https:";
        this.path = options.path ? options.path.charAt(0) !== "/" ? `/${options.path}` : options.path : "/";
        this.username = options.username;
        this.password = options.password;
        this.fragment = options.fragment;
      }
      static clone(request) {
        const cloned = new _HttpRequest({
          ...request,
          headers: { ...request.headers }
        });
        if (cloned.query) {
          cloned.query = cloneQuery(cloned.query);
        }
        return cloned;
      }
      static isInstance(request) {
        if (!request) {
          return false;
        }
        const req = request;
        return "method" in req && "protocol" in req && "hostname" in req && "path" in req && typeof req["query"] === "object" && typeof req["headers"] === "object";
      }
      clone() {
        return _HttpRequest.clone(this);
      }
    };
    __name(cloneQuery, "cloneQuery");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/httpResponse.js
var HttpResponse;
var init_httpResponse = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/httpResponse.js"() {
    HttpResponse = class {
      static {
        __name(this, "HttpResponse");
      }
      statusCode;
      reason;
      headers;
      body;
      constructor(options) {
        this.statusCode = options.statusCode;
        this.reason = options.reason;
        this.headers = options.headers || {};
        this.body = options.body;
      }
      static isInstance(response) {
        if (!response)
          return false;
        const resp = response;
        return typeof resp.statusCode === "number" && typeof resp.headers === "object";
      }
    };
  }
});

// node_modules/tslib/tslib.es6.mjs
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  __name(adopt, "adopt");
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e2) {
        reject(e2);
      }
    }
    __name(fulfilled, "fulfilled");
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e2) {
        reject(e2);
      }
    }
    __name(rejected, "rejected");
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    __name(step, "step");
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __generator(thisArg, body) {
  var _ = { label: 0, sent: /* @__PURE__ */ __name(function() {
    if (t8[0] & 1) throw t8[1];
    return t8[1];
  }, "sent"), trys: [], ops: [] }, f2, y2, t8, g2 = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g2.next = verb(0), g2["throw"] = verb(1), g2["return"] = verb(2), typeof Symbol === "function" && (g2[Symbol.iterator] = function() {
    return this;
  }), g2;
  function verb(n2) {
    return function(v2) {
      return step([n2, v2]);
    };
  }
  __name(verb, "verb");
  function step(op) {
    if (f2) throw new TypeError("Generator is already executing.");
    while (g2 && (g2 = 0, op[0] && (_ = 0)), _) try {
      if (f2 = 1, y2 && (t8 = op[0] & 2 ? y2["return"] : op[0] ? y2["throw"] || ((t8 = y2["return"]) && t8.call(y2), 0) : y2.next) && !(t8 = t8.call(y2, op[1])).done) return t8;
      if (y2 = 0, t8) op = [op[0] & 2, t8.value];
      switch (op[0]) {
        case 0:
        case 1:
          t8 = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y2 = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t8 = _.trys, t8 = t8.length > 0 && t8[t8.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t8 || op[1] > t8[0] && op[1] < t8[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t8[1]) {
            _.label = t8[1];
            t8 = op;
            break;
          }
          if (t8 && _.label < t8[2]) {
            _.label = t8[2];
            _.ops.push(op);
            break;
          }
          if (t8[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e2) {
      op = [6, e2];
      y2 = 0;
    } finally {
      f2 = t8 = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
  __name(step, "step");
}
function __values(o2) {
  var s2 = typeof Symbol === "function" && Symbol.iterator, m2 = s2 && o2[s2], i2 = 0;
  if (m2) return m2.call(o2);
  if (o2 && typeof o2.length === "number") return {
    next: /* @__PURE__ */ __name(function() {
      if (o2 && i2 >= o2.length) o2 = void 0;
      return { value: o2 && o2[i2++], done: !o2 };
    }, "next")
  };
  throw new TypeError(s2 ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
var init_tslib_es6 = __esm({
  "node_modules/tslib/tslib.es6.mjs"() {
    __name(__awaiter, "__awaiter");
    __name(__generator, "__generator");
    __name(__values, "__values");
  }
});

// node_modules/@smithy/util-utf8/dist-es/fromUtf8.browser.js
var fromUtf82;
var init_fromUtf8_browser2 = __esm({
  "node_modules/@smithy/util-utf8/dist-es/fromUtf8.browser.js"() {
    fromUtf82 = /* @__PURE__ */ __name((input) => new TextEncoder().encode(input), "fromUtf8");
  }
});

// node_modules/@smithy/util-utf8/dist-es/toUint8Array.js
var init_toUint8Array = __esm({
  "node_modules/@smithy/util-utf8/dist-es/toUint8Array.js"() {
    init_fromUtf8_browser2();
  }
});

// node_modules/@smithy/util-utf8/dist-es/toUtf8.browser.js
var init_toUtf8_browser2 = __esm({
  "node_modules/@smithy/util-utf8/dist-es/toUtf8.browser.js"() {
  }
});

// node_modules/@smithy/util-utf8/dist-es/index.js
var init_dist_es2 = __esm({
  "node_modules/@smithy/util-utf8/dist-es/index.js"() {
    init_fromUtf8_browser2();
    init_toUint8Array();
    init_toUtf8_browser2();
  }
});

// node_modules/@aws-crypto/util/build/module/convertToBuffer.js
function convertToBuffer(data) {
  if (data instanceof Uint8Array)
    return data;
  if (typeof data === "string") {
    return fromUtf83(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
  }
  return new Uint8Array(data);
}
var fromUtf83;
var init_convertToBuffer = __esm({
  "node_modules/@aws-crypto/util/build/module/convertToBuffer.js"() {
    init_dist_es2();
    fromUtf83 = typeof Buffer !== "undefined" && Buffer.from ? function(input) {
      return Buffer.from(input, "utf8");
    } : fromUtf82;
    __name(convertToBuffer, "convertToBuffer");
  }
});

// node_modules/@aws-crypto/util/build/module/isEmptyData.js
function isEmptyData(data) {
  if (typeof data === "string") {
    return data.length === 0;
  }
  return data.byteLength === 0;
}
var init_isEmptyData = __esm({
  "node_modules/@aws-crypto/util/build/module/isEmptyData.js"() {
    __name(isEmptyData, "isEmptyData");
  }
});

// node_modules/@aws-crypto/util/build/module/numToUint8.js
function numToUint8(num) {
  return new Uint8Array([
    (num & 4278190080) >> 24,
    (num & 16711680) >> 16,
    (num & 65280) >> 8,
    num & 255
  ]);
}
var init_numToUint8 = __esm({
  "node_modules/@aws-crypto/util/build/module/numToUint8.js"() {
    __name(numToUint8, "numToUint8");
  }
});

// node_modules/@aws-crypto/util/build/module/uint32ArrayFrom.js
function uint32ArrayFrom(a_lookUpTable2) {
  if (!Uint32Array.from) {
    var return_array = new Uint32Array(a_lookUpTable2.length);
    var a_index = 0;
    while (a_index < a_lookUpTable2.length) {
      return_array[a_index] = a_lookUpTable2[a_index];
      a_index += 1;
    }
    return return_array;
  }
  return Uint32Array.from(a_lookUpTable2);
}
var init_uint32ArrayFrom = __esm({
  "node_modules/@aws-crypto/util/build/module/uint32ArrayFrom.js"() {
    __name(uint32ArrayFrom, "uint32ArrayFrom");
  }
});

// node_modules/@aws-crypto/util/build/module/index.js
var init_module = __esm({
  "node_modules/@aws-crypto/util/build/module/index.js"() {
    init_convertToBuffer();
    init_isEmptyData();
    init_numToUint8();
    init_uint32ArrayFrom();
  }
});

// node_modules/@aws-crypto/crc32/build/module/aws_crc32.js
var AwsCrc32;
var init_aws_crc32 = __esm({
  "node_modules/@aws-crypto/crc32/build/module/aws_crc32.js"() {
    init_tslib_es6();
    init_module();
    init_module2();
    AwsCrc32 = /** @class */
    (function() {
      function AwsCrc322() {
        this.crc32 = new Crc32();
      }
      __name(AwsCrc322, "AwsCrc32");
      AwsCrc322.prototype.update = function(toHash) {
        if (isEmptyData(toHash))
          return;
        this.crc32.update(convertToBuffer(toHash));
      };
      AwsCrc322.prototype.digest = function() {
        return __awaiter(this, void 0, void 0, function() {
          return __generator(this, function(_a) {
            return [2, numToUint8(this.crc32.digest())];
          });
        });
      };
      AwsCrc322.prototype.reset = function() {
        this.crc32 = new Crc32();
      };
      return AwsCrc322;
    })();
  }
});

// node_modules/@aws-crypto/crc32/build/module/index.js
var Crc32, a_lookUpTable, lookupTable;
var init_module2 = __esm({
  "node_modules/@aws-crypto/crc32/build/module/index.js"() {
    init_tslib_es6();
    init_module();
    init_aws_crc32();
    Crc32 = /** @class */
    (function() {
      function Crc322() {
        this.checksum = 4294967295;
      }
      __name(Crc322, "Crc32");
      Crc322.prototype.update = function(data) {
        var e_1, _a;
        try {
          for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var byte = data_1_1.value;
            this.checksum = this.checksum >>> 8 ^ lookupTable[(this.checksum ^ byte) & 255];
          }
        } catch (e_1_1) {
          e_1 = { error: e_1_1 };
        } finally {
          try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
          } finally {
            if (e_1) throw e_1.error;
          }
        }
        return this;
      };
      Crc322.prototype.digest = function() {
        return (this.checksum ^ 4294967295) >>> 0;
      };
      return Crc322;
    })();
    a_lookUpTable = [
      0,
      1996959894,
      3993919788,
      2567524794,
      124634137,
      1886057615,
      3915621685,
      2657392035,
      249268274,
      2044508324,
      3772115230,
      2547177864,
      162941995,
      2125561021,
      3887607047,
      2428444049,
      498536548,
      1789927666,
      4089016648,
      2227061214,
      450548861,
      1843258603,
      4107580753,
      2211677639,
      325883990,
      1684777152,
      4251122042,
      2321926636,
      335633487,
      1661365465,
      4195302755,
      2366115317,
      997073096,
      1281953886,
      3579855332,
      2724688242,
      1006888145,
      1258607687,
      3524101629,
      2768942443,
      901097722,
      1119000684,
      3686517206,
      2898065728,
      853044451,
      1172266101,
      3705015759,
      2882616665,
      651767980,
      1373503546,
      3369554304,
      3218104598,
      565507253,
      1454621731,
      3485111705,
      3099436303,
      671266974,
      1594198024,
      3322730930,
      2970347812,
      795835527,
      1483230225,
      3244367275,
      3060149565,
      1994146192,
      31158534,
      2563907772,
      4023717930,
      1907459465,
      112637215,
      2680153253,
      3904427059,
      2013776290,
      251722036,
      2517215374,
      3775830040,
      2137656763,
      141376813,
      2439277719,
      3865271297,
      1802195444,
      476864866,
      2238001368,
      4066508878,
      1812370925,
      453092731,
      2181625025,
      4111451223,
      1706088902,
      314042704,
      2344532202,
      4240017532,
      1658658271,
      366619977,
      2362670323,
      4224994405,
      1303535960,
      984961486,
      2747007092,
      3569037538,
      1256170817,
      1037604311,
      2765210733,
      3554079995,
      1131014506,
      879679996,
      2909243462,
      3663771856,
      1141124467,
      855842277,
      2852801631,
      3708648649,
      1342533948,
      654459306,
      3188396048,
      3373015174,
      1466479909,
      544179635,
      3110523913,
      3462522015,
      1591671054,
      702138776,
      2966460450,
      3352799412,
      1504918807,
      783551873,
      3082640443,
      3233442989,
      3988292384,
      2596254646,
      62317068,
      1957810842,
      3939845945,
      2647816111,
      81470997,
      1943803523,
      3814918930,
      2489596804,
      225274430,
      2053790376,
      3826175755,
      2466906013,
      167816743,
      2097651377,
      4027552580,
      2265490386,
      503444072,
      1762050814,
      4150417245,
      2154129355,
      426522225,
      1852507879,
      4275313526,
      2312317920,
      282753626,
      1742555852,
      4189708143,
      2394877945,
      397917763,
      1622183637,
      3604390888,
      2714866558,
      953729732,
      1340076626,
      3518719985,
      2797360999,
      1068828381,
      1219638859,
      3624741850,
      2936675148,
      906185462,
      1090812512,
      3747672003,
      2825379669,
      829329135,
      1181335161,
      3412177804,
      3160834842,
      628085408,
      1382605366,
      3423369109,
      3138078467,
      570562233,
      1426400815,
      3317316542,
      2998733608,
      733239954,
      1555261956,
      3268935591,
      3050360625,
      752459403,
      1541320221,
      2607071920,
      3965973030,
      1969922972,
      40735498,
      2617837225,
      3943577151,
      1913087877,
      83908371,
      2512341634,
      3803740692,
      2075208622,
      213261112,
      2463272603,
      3855990285,
      2094854071,
      198958881,
      2262029012,
      4057260610,
      1759359992,
      534414190,
      2176718541,
      4139329115,
      1873836001,
      414664567,
      2282248934,
      4279200368,
      1711684554,
      285281116,
      2405801727,
      4167216745,
      1634467795,
      376229701,
      2685067896,
      3608007406,
      1308918612,
      956543938,
      2808555105,
      3495958263,
      1231636301,
      1047427035,
      2932959818,
      3654703836,
      1088359270,
      936918e3,
      2847714899,
      3736837829,
      1202900863,
      817233897,
      3183342108,
      3401237130,
      1404277552,
      615818150,
      3134207493,
      3453421203,
      1423857449,
      601450431,
      3009837614,
      3294710456,
      1567103746,
      711928724,
      3020668471,
      3272380065,
      1510334235,
      755167117
    ];
    lookupTable = uint32ArrayFrom(a_lookUpTable);
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/Int64.js
function negate(bytes) {
  for (let i2 = 0; i2 < 8; i2++) {
    bytes[i2] ^= 255;
  }
  for (let i2 = 7; i2 > -1; i2--) {
    bytes[i2]++;
    if (bytes[i2] !== 0)
      break;
  }
}
var Int64;
var init_Int64 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/Int64.js"() {
    init_index_browser2();
    Int64 = class _Int64 {
      static {
        __name(this, "Int64");
      }
      bytes;
      constructor(bytes) {
        this.bytes = bytes;
        if (bytes.byteLength !== 8) {
          throw new Error("Int64 buffers must be exactly 8 bytes");
        }
      }
      static fromNumber(number) {
        if (number > 9223372036854776e3 || number < -9223372036854776e3) {
          throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
        }
        const bytes = new Uint8Array(8);
        for (let i2 = 7, remaining = Math.abs(Math.round(number)); i2 > -1 && remaining > 0; i2--, remaining /= 256) {
          bytes[i2] = remaining;
        }
        if (number < 0) {
          negate(bytes);
        }
        return new _Int64(bytes);
      }
      valueOf() {
        const bytes = this.bytes.slice(0);
        const negative = bytes[0] & 128;
        if (negative) {
          negate(bytes);
        }
        return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
      }
      toString() {
        return String(this.valueOf());
      }
    };
    __name(negate, "negate");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/HeaderMarshaller.js
var HeaderMarshaller, HEADER_VALUE_TYPE, BOOLEAN_TAG, BYTE_TAG, SHORT_TAG, INT_TAG, LONG_TAG, BINARY_TAG, STRING_TAG, TIMESTAMP_TAG, UUID_TAG, UUID_PATTERN;
var init_HeaderMarshaller = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/HeaderMarshaller.js"() {
    init_index_browser2();
    init_Int64();
    HeaderMarshaller = class {
      static {
        __name(this, "HeaderMarshaller");
      }
      toUtf8;
      fromUtf8;
      constructor(toUtf82, fromUtf84) {
        this.toUtf8 = toUtf82;
        this.fromUtf8 = fromUtf84;
      }
      format(headers) {
        const chunks = [];
        for (const headerName of Object.keys(headers)) {
          const bytes = this.fromUtf8(headerName);
          chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
        }
        const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
        let position = 0;
        for (const chunk of chunks) {
          out.set(chunk, position);
          position += chunk.byteLength;
        }
        return out;
      }
      formatHeaderValue(header) {
        switch (header.type) {
          case "boolean":
            return Uint8Array.from([header.value ? 0 : 1]);
          case "byte":
            return Uint8Array.from([2, header.value]);
          case "short":
            const shortView = new DataView(new ArrayBuffer(3));
            shortView.setUint8(0, 3);
            shortView.setInt16(1, header.value, false);
            return new Uint8Array(shortView.buffer);
          case "integer":
            const intView = new DataView(new ArrayBuffer(5));
            intView.setUint8(0, 4);
            intView.setInt32(1, header.value, false);
            return new Uint8Array(intView.buffer);
          case "long":
            const longBytes = new Uint8Array(9);
            longBytes[0] = 5;
            longBytes.set(header.value.bytes, 1);
            return longBytes;
          case "binary":
            const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
            binView.setUint8(0, 6);
            binView.setUint16(1, header.value.byteLength, false);
            const binBytes = new Uint8Array(binView.buffer);
            binBytes.set(header.value, 3);
            return binBytes;
          case "string":
            const utf8Bytes = this.fromUtf8(header.value);
            const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
            strView.setUint8(0, 7);
            strView.setUint16(1, utf8Bytes.byteLength, false);
            const strBytes = new Uint8Array(strView.buffer);
            strBytes.set(utf8Bytes, 3);
            return strBytes;
          case "timestamp":
            const tsBytes = new Uint8Array(9);
            tsBytes[0] = 8;
            tsBytes.set(Int64.fromNumber(header.value.valueOf()).bytes, 1);
            return tsBytes;
          case "uuid":
            if (!UUID_PATTERN.test(header.value)) {
              throw new Error(`Invalid UUID received: ${header.value}`);
            }
            const uuidBytes = new Uint8Array(17);
            uuidBytes[0] = 9;
            uuidBytes.set(fromHex(header.value.replace(/\-/g, "")), 1);
            return uuidBytes;
        }
      }
      parse(headers) {
        const out = {};
        let position = 0;
        while (position < headers.byteLength) {
          const nameLength = headers.getUint8(position++);
          const name = this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, nameLength));
          position += nameLength;
          switch (headers.getUint8(position++)) {
            case 0:
              out[name] = {
                type: BOOLEAN_TAG,
                value: true
              };
              break;
            case 1:
              out[name] = {
                type: BOOLEAN_TAG,
                value: false
              };
              break;
            case 2:
              out[name] = {
                type: BYTE_TAG,
                value: headers.getInt8(position++)
              };
              break;
            case 3:
              out[name] = {
                type: SHORT_TAG,
                value: headers.getInt16(position, false)
              };
              position += 2;
              break;
            case 4:
              out[name] = {
                type: INT_TAG,
                value: headers.getInt32(position, false)
              };
              position += 4;
              break;
            case 5:
              out[name] = {
                type: LONG_TAG,
                value: new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8))
              };
              position += 8;
              break;
            case 6:
              const binaryLength = headers.getUint16(position, false);
              position += 2;
              out[name] = {
                type: BINARY_TAG,
                value: new Uint8Array(headers.buffer, headers.byteOffset + position, binaryLength)
              };
              position += binaryLength;
              break;
            case 7:
              const stringLength = headers.getUint16(position, false);
              position += 2;
              out[name] = {
                type: STRING_TAG,
                value: this.toUtf8(new Uint8Array(headers.buffer, headers.byteOffset + position, stringLength))
              };
              position += stringLength;
              break;
            case 8:
              out[name] = {
                type: TIMESTAMP_TAG,
                value: new Date(new Int64(new Uint8Array(headers.buffer, headers.byteOffset + position, 8)).valueOf())
              };
              position += 8;
              break;
            case 9:
              const uuidBytes = new Uint8Array(headers.buffer, headers.byteOffset + position, 16);
              position += 16;
              out[name] = {
                type: UUID_TAG,
                value: `${toHex(uuidBytes.subarray(0, 4))}-${toHex(uuidBytes.subarray(4, 6))}-${toHex(uuidBytes.subarray(6, 8))}-${toHex(uuidBytes.subarray(8, 10))}-${toHex(uuidBytes.subarray(10))}`
              };
              break;
            default:
              throw new Error(`Unrecognized header type tag`);
          }
        }
        return out;
      }
    };
    (function(HEADER_VALUE_TYPE3) {
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["boolTrue"] = 0] = "boolTrue";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["boolFalse"] = 1] = "boolFalse";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["byte"] = 2] = "byte";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["short"] = 3] = "short";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["integer"] = 4] = "integer";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["long"] = 5] = "long";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["byteArray"] = 6] = "byteArray";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["string"] = 7] = "string";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["timestamp"] = 8] = "timestamp";
      HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["uuid"] = 9] = "uuid";
    })(HEADER_VALUE_TYPE || (HEADER_VALUE_TYPE = {}));
    BOOLEAN_TAG = "boolean";
    BYTE_TAG = "byte";
    SHORT_TAG = "short";
    INT_TAG = "integer";
    LONG_TAG = "long";
    BINARY_TAG = "binary";
    STRING_TAG = "string";
    TIMESTAMP_TAG = "timestamp";
    UUID_TAG = "uuid";
    UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/splitMessage.js
function splitMessage({ byteLength, byteOffset, buffer }) {
  if (byteLength < MINIMUM_MESSAGE_LENGTH) {
    throw new Error("Provided message too short to accommodate event stream message overhead");
  }
  const view = new DataView(buffer, byteOffset, byteLength);
  const messageLength = view.getUint32(0, false);
  if (byteLength !== messageLength) {
    throw new Error("Reported message length does not match received message length");
  }
  const headerLength = view.getUint32(PRELUDE_MEMBER_LENGTH, false);
  const expectedPreludeChecksum = view.getUint32(PRELUDE_LENGTH, false);
  const expectedMessageChecksum = view.getUint32(byteLength - CHECKSUM_LENGTH, false);
  const checksummer = new Crc32().update(new Uint8Array(buffer, byteOffset, PRELUDE_LENGTH));
  if (expectedPreludeChecksum !== checksummer.digest()) {
    throw new Error(`The prelude checksum specified in the message (${expectedPreludeChecksum}) does not match the calculated CRC32 checksum (${checksummer.digest()})`);
  }
  checksummer.update(new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH, byteLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH)));
  if (expectedMessageChecksum !== checksummer.digest()) {
    throw new Error(`The message checksum (${checksummer.digest()}) did not match the expected value of ${expectedMessageChecksum}`);
  }
  return {
    headers: new DataView(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH, headerLength),
    body: new Uint8Array(buffer, byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH + headerLength, messageLength - headerLength - (PRELUDE_LENGTH + CHECKSUM_LENGTH + CHECKSUM_LENGTH))
  };
}
var PRELUDE_MEMBER_LENGTH, PRELUDE_LENGTH, CHECKSUM_LENGTH, MINIMUM_MESSAGE_LENGTH;
var init_splitMessage = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/splitMessage.js"() {
    init_module2();
    PRELUDE_MEMBER_LENGTH = 4;
    PRELUDE_LENGTH = PRELUDE_MEMBER_LENGTH * 2;
    CHECKSUM_LENGTH = 4;
    MINIMUM_MESSAGE_LENGTH = PRELUDE_LENGTH + CHECKSUM_LENGTH * 2;
    __name(splitMessage, "splitMessage");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/EventStreamCodec.js
var EventStreamCodec;
var init_EventStreamCodec = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/EventStreamCodec.js"() {
    init_module2();
    init_HeaderMarshaller();
    init_splitMessage();
    EventStreamCodec = class {
      static {
        __name(this, "EventStreamCodec");
      }
      headerMarshaller;
      messageBuffer;
      isEndOfStream;
      constructor(toUtf82, fromUtf84) {
        this.headerMarshaller = new HeaderMarshaller(toUtf82, fromUtf84);
        this.messageBuffer = [];
        this.isEndOfStream = false;
      }
      feed(message) {
        this.messageBuffer.push(this.decode(message));
      }
      endOfStream() {
        this.isEndOfStream = true;
      }
      getMessage() {
        const message = this.messageBuffer.pop();
        const isEndOfStream = this.isEndOfStream;
        return {
          getMessage() {
            return message;
          },
          isEndOfStream() {
            return isEndOfStream;
          }
        };
      }
      getAvailableMessages() {
        const messages = this.messageBuffer;
        this.messageBuffer = [];
        const isEndOfStream = this.isEndOfStream;
        return {
          getMessages() {
            return messages;
          },
          isEndOfStream() {
            return isEndOfStream;
          }
        };
      }
      encode({ headers: rawHeaders, body }) {
        const headers = this.headerMarshaller.format(rawHeaders);
        const length = headers.byteLength + body.byteLength + 16;
        const out = new Uint8Array(length);
        const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
        const checksum = new Crc32();
        view.setUint32(0, length, false);
        view.setUint32(4, headers.byteLength, false);
        view.setUint32(8, checksum.update(out.subarray(0, 8)).digest(), false);
        out.set(headers, 12);
        out.set(body, headers.byteLength + 12);
        view.setUint32(length - 4, checksum.update(out.subarray(8, length - 4)).digest(), false);
        return out;
      }
      decode(message) {
        const { headers, body } = splitMessage(message);
        return { headers: this.headerMarshaller.parse(headers), body };
      }
      formatHeaders(rawHeaders) {
        return this.headerMarshaller.format(rawHeaders);
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/MessageDecoderStream.js
var MessageDecoderStream;
var init_MessageDecoderStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/MessageDecoderStream.js"() {
    MessageDecoderStream = class {
      static {
        __name(this, "MessageDecoderStream");
      }
      options;
      constructor(options) {
        this.options = options;
      }
      [Symbol.asyncIterator]() {
        return this.asyncIterator();
      }
      async *asyncIterator() {
        for await (const bytes of this.options.inputStream) {
          const decoded = this.options.decoder.decode(bytes);
          yield decoded;
        }
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/MessageEncoderStream.js
var MessageEncoderStream;
var init_MessageEncoderStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/MessageEncoderStream.js"() {
    MessageEncoderStream = class {
      static {
        __name(this, "MessageEncoderStream");
      }
      options;
      constructor(options) {
        this.options = options;
      }
      [Symbol.asyncIterator]() {
        return this.asyncIterator();
      }
      async *asyncIterator() {
        for await (const msg of this.options.messageStream) {
          const encoded = this.options.encoder.encode(msg);
          yield encoded;
        }
        if (this.options.includeEndFrame) {
          yield new Uint8Array(0);
        }
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/SmithyMessageDecoderStream.js
var SmithyMessageDecoderStream;
var init_SmithyMessageDecoderStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/SmithyMessageDecoderStream.js"() {
    SmithyMessageDecoderStream = class {
      static {
        __name(this, "SmithyMessageDecoderStream");
      }
      options;
      constructor(options) {
        this.options = options;
      }
      [Symbol.asyncIterator]() {
        return this.asyncIterator();
      }
      async *asyncIterator() {
        for await (const message of this.options.messageStream) {
          const deserialized = await this.options.deserializer(message);
          if (deserialized === void 0)
            continue;
          yield deserialized;
        }
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/SmithyMessageEncoderStream.js
var SmithyMessageEncoderStream;
var init_SmithyMessageEncoderStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-codec/SmithyMessageEncoderStream.js"() {
    SmithyMessageEncoderStream = class {
      static {
        __name(this, "SmithyMessageEncoderStream");
      }
      options;
      constructor(options) {
        this.options = options;
      }
      [Symbol.asyncIterator]() {
        return this.asyncIterator();
      }
      async *asyncIterator() {
        for await (const chunk of this.options.inputStream) {
          const payloadBuf = this.options.serializer(chunk);
          yield payloadBuf;
        }
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/getChunkedStream.js
function getChunkedStream(source) {
  let currentMessageTotalLength = 0;
  let currentMessagePendingLength = 0;
  let currentMessage = null;
  let messageLengthBuffer = null;
  const allocateMessage = /* @__PURE__ */ __name((size) => {
    if (typeof size !== "number") {
      throw new Error("Attempted to allocate an event message where size was not a number: " + size);
    }
    currentMessageTotalLength = size;
    currentMessagePendingLength = 4;
    currentMessage = new Uint8Array(size);
    const currentMessageView = new DataView(currentMessage.buffer);
    currentMessageView.setUint32(0, size, false);
  }, "allocateMessage");
  const iterator = /* @__PURE__ */ __name(async function* () {
    const sourceIterator = source[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await sourceIterator.next();
      if (done) {
        if (!currentMessageTotalLength) {
          return;
        } else if (currentMessageTotalLength === currentMessagePendingLength) {
          yield currentMessage;
        } else {
          throw new Error("Truncated event message received.");
        }
        return;
      }
      const chunkLength = value.length;
      let currentOffset = 0;
      while (currentOffset < chunkLength) {
        if (!currentMessage) {
          const bytesRemaining = chunkLength - currentOffset;
          if (!messageLengthBuffer) {
            messageLengthBuffer = new Uint8Array(4);
          }
          const numBytesForTotal = Math.min(4 - currentMessagePendingLength, bytesRemaining);
          messageLengthBuffer.set(value.slice(currentOffset, currentOffset + numBytesForTotal), currentMessagePendingLength);
          currentMessagePendingLength += numBytesForTotal;
          currentOffset += numBytesForTotal;
          if (currentMessagePendingLength < 4) {
            break;
          }
          allocateMessage(new DataView(messageLengthBuffer.buffer).getUint32(0, false));
          messageLengthBuffer = null;
        }
        const numBytesToWrite = Math.min(currentMessageTotalLength - currentMessagePendingLength, chunkLength - currentOffset);
        currentMessage.set(value.slice(currentOffset, currentOffset + numBytesToWrite), currentMessagePendingLength);
        currentMessagePendingLength += numBytesToWrite;
        currentOffset += numBytesToWrite;
        if (currentMessageTotalLength && currentMessageTotalLength === currentMessagePendingLength) {
          yield currentMessage;
          currentMessage = null;
          currentMessageTotalLength = 0;
          currentMessagePendingLength = 0;
        }
      }
    }
  }, "iterator");
  return {
    [Symbol.asyncIterator]: iterator
  };
}
var init_getChunkedStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/getChunkedStream.js"() {
    __name(getChunkedStream, "getChunkedStream");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/getUnmarshalledStream.js
function getUnmarshalledStream(source, options) {
  const messageUnmarshaller = getMessageUnmarshaller(options.deserializer, options.toUtf8);
  return {
    [Symbol.asyncIterator]: async function* () {
      for await (const chunk of source) {
        const message = options.eventStreamCodec.decode(chunk);
        const type = await messageUnmarshaller(message);
        if (type === void 0)
          continue;
        yield type;
      }
    }
  };
}
function getMessageUnmarshaller(deserializer, toUtf82) {
  return async function(message) {
    const { value: messageType } = message.headers[":message-type"];
    if (messageType === "error") {
      const unmodeledError = new Error(message.headers[":error-message"].value || "UnknownError");
      unmodeledError.name = message.headers[":error-code"].value;
      throw unmodeledError;
    } else if (messageType === "exception") {
      const code = message.headers[":exception-type"].value;
      const exception = { [code]: message };
      const deserializedException = await deserializer(exception);
      if (deserializedException.$unknown) {
        const error = new Error(toUtf82(message.body));
        error.name = code;
        throw error;
      }
      throw deserializedException[code];
    } else if (messageType === "event") {
      const event = {
        [message.headers[":event-type"].value]: message
      };
      const deserialized = await deserializer(event);
      if (deserialized.$unknown)
        return;
      return deserialized;
    } else {
      throw Error(`Unrecognizable event type: ${message.headers[":event-type"].value}`);
    }
  };
}
var init_getUnmarshalledStream = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/getUnmarshalledStream.js"() {
    __name(getUnmarshalledStream, "getUnmarshalledStream");
    __name(getMessageUnmarshaller, "getMessageUnmarshaller");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/EventStreamMarshaller.js
var EventStreamMarshaller, eventStreamSerdeProvider;
var init_EventStreamMarshaller = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-universal/EventStreamMarshaller.js"() {
    init_EventStreamCodec();
    init_MessageDecoderStream();
    init_MessageEncoderStream();
    init_SmithyMessageDecoderStream();
    init_SmithyMessageEncoderStream();
    init_getChunkedStream();
    init_getUnmarshalledStream();
    EventStreamMarshaller = class {
      static {
        __name(this, "EventStreamMarshaller");
      }
      eventStreamCodec;
      utfEncoder;
      constructor({ utf8Encoder, utf8Decoder: utf8Decoder2 }) {
        this.eventStreamCodec = new EventStreamCodec(utf8Encoder, utf8Decoder2);
        this.utfEncoder = utf8Encoder;
      }
      deserialize(body, deserializer) {
        const inputStream = getChunkedStream(body);
        return new SmithyMessageDecoderStream({
          messageStream: new MessageDecoderStream({ inputStream, decoder: this.eventStreamCodec }),
          deserializer: getMessageUnmarshaller(deserializer, this.utfEncoder)
        });
      }
      serialize(inputStream, serializer) {
        return new MessageEncoderStream({
          messageStream: new SmithyMessageEncoderStream({ inputStream, serializer }),
          encoder: this.eventStreamCodec,
          includeEndFrame: true
        });
      }
    };
    eventStreamSerdeProvider = /* @__PURE__ */ __name((options) => new EventStreamMarshaller(options), "eventStreamSerdeProvider");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde/utils.js
var readableStreamToIterable, iterableToReadableStream;
var init_utils = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde/utils.js"() {
    readableStreamToIterable = /* @__PURE__ */ __name((readableStream) => ({
      [Symbol.asyncIterator]: async function* () {
        const reader = readableStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              return;
            yield value;
          }
        } finally {
          reader.releaseLock();
        }
      }
    }), "readableStreamToIterable");
    iterableToReadableStream = /* @__PURE__ */ __name((asyncIterable) => {
      const iterator = asyncIterable[Symbol.asyncIterator]();
      return new ReadableStream({
        async pull(controller) {
          const { done, value } = await iterator.next();
          if (done) {
            return controller.close();
          }
          controller.enqueue(value);
        }
      });
    }, "iterableToReadableStream");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde/EventStreamMarshaller.browser.js
var EventStreamMarshaller2, isReadableStream2, eventStreamSerdeProvider2;
var init_EventStreamMarshaller_browser = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde/EventStreamMarshaller.browser.js"() {
    init_EventStreamMarshaller();
    init_utils();
    EventStreamMarshaller2 = class {
      static {
        __name(this, "EventStreamMarshaller");
      }
      universalMarshaller;
      constructor({ utf8Encoder, utf8Decoder: utf8Decoder2 }) {
        this.universalMarshaller = new EventStreamMarshaller({
          utf8Decoder: utf8Decoder2,
          utf8Encoder
        });
      }
      deserialize(body, deserializer) {
        const bodyIterable = isReadableStream2(body) ? readableStreamToIterable(body) : body;
        return this.universalMarshaller.deserialize(bodyIterable, deserializer);
      }
      serialize(input, serializer) {
        const serializedIterable = this.universalMarshaller.serialize(input, serializer);
        return typeof ReadableStream === "function" ? iterableToReadableStream(serializedIterable) : serializedIterable;
      }
    };
    isReadableStream2 = /* @__PURE__ */ __name((body) => typeof ReadableStream === "function" && body instanceof ReadableStream, "isReadableStream");
    eventStreamSerdeProvider2 = /* @__PURE__ */ __name((options) => new EventStreamMarshaller2(options), "eventStreamSerdeProvider");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-config-resolver/EventStreamSerdeConfig.js
var resolveEventStreamSerdeConfig;
var init_EventStreamSerdeConfig = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/eventstream-serde-config-resolver/EventStreamSerdeConfig.js"() {
    resolveEventStreamSerdeConfig = /* @__PURE__ */ __name((input) => Object.assign(input, {
      eventStreamMarshaller: input.eventStreamSerdeProvider(input)
    }), "resolveEventStreamSerdeConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/EventStreamSerde.js
var EventStreamSerde;
var init_EventStreamSerde = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/EventStreamSerde.js"() {
    init_index_browser2();
    EventStreamSerde = class {
      static {
        __name(this, "EventStreamSerde");
      }
      marshaller;
      serializer;
      deserializer;
      serdeContext;
      defaultContentType;
      constructor({ marshaller, serializer, deserializer, serdeContext, defaultContentType }) {
        this.marshaller = marshaller;
        this.serializer = serializer;
        this.deserializer = deserializer;
        this.serdeContext = serdeContext;
        this.defaultContentType = defaultContentType;
      }
      async serializeEventStream({ eventStream, requestSchema, initialRequest }) {
        const marshaller = this.marshaller;
        const eventStreamMember = requestSchema.getEventStreamMember();
        const unionSchema = requestSchema.getMemberSchema(eventStreamMember);
        const serializer = this.serializer;
        const defaultContentType = this.defaultContentType;
        const initialRequestMarker = /* @__PURE__ */ Symbol("initialRequestMarker");
        const eventStreamIterable = {
          async *[Symbol.asyncIterator]() {
            if (initialRequest) {
              const headers = {
                ":event-type": { type: "string", value: "initial-request" },
                ":message-type": { type: "string", value: "event" },
                ":content-type": { type: "string", value: defaultContentType }
              };
              serializer.write(requestSchema, initialRequest);
              const body = serializer.flush();
              yield {
                [initialRequestMarker]: true,
                headers,
                body
              };
            }
            for await (const page of eventStream) {
              yield page;
            }
          }
        };
        return marshaller.serialize(eventStreamIterable, (event) => {
          if (event[initialRequestMarker]) {
            return {
              headers: event.headers,
              body: event.body
            };
          }
          let unionMember = "";
          for (const key in event) {
            if (key !== "__type") {
              unionMember = key;
              break;
            }
          }
          const { additionalHeaders, body, eventType, explicitPayloadContentType } = this.writeEventBody(unionMember, unionSchema, event);
          const headers = {
            ":event-type": { type: "string", value: eventType },
            ":message-type": { type: "string", value: "event" },
            ":content-type": { type: "string", value: explicitPayloadContentType ?? defaultContentType },
            ...additionalHeaders
          };
          return {
            headers,
            body
          };
        });
      }
      async deserializeEventStream({ response, responseSchema, initialResponseContainer }) {
        const marshaller = this.marshaller;
        const eventStreamMember = responseSchema.getEventStreamMember();
        const unionSchema = responseSchema.getMemberSchema(eventStreamMember);
        const memberSchemas = unionSchema.getMemberSchemas();
        const initialResponseMarker = /* @__PURE__ */ Symbol("initialResponseMarker");
        const asyncIterable = marshaller.deserialize(response.body, async (event) => {
          let unionMember = "";
          for (const key in event) {
            if (key !== "__type") {
              unionMember = key;
              break;
            }
          }
          const body = event[unionMember].body;
          if (unionMember === "initial-response") {
            const dataObject = await this.deserializer.read(responseSchema, body);
            delete dataObject[eventStreamMember];
            return {
              [initialResponseMarker]: true,
              ...dataObject
            };
          } else if (unionMember in memberSchemas) {
            const eventStreamSchema = memberSchemas[unionMember];
            if (eventStreamSchema.isStructSchema()) {
              const out = {};
              let hasBindings = false;
              for (const [name, member2] of eventStreamSchema.structIterator()) {
                const { eventHeader, eventPayload } = member2.getMergedTraits();
                hasBindings = hasBindings || Boolean(eventHeader || eventPayload);
                if (eventPayload) {
                  if (member2.isBlobSchema()) {
                    out[name] = body;
                  } else if (member2.isStringSchema()) {
                    out[name] = (this.serdeContext?.utf8Encoder ?? toUtf8)(body);
                  } else if (member2.isStructSchema()) {
                    out[name] = await this.deserializer.read(member2, body);
                  }
                } else if (eventHeader) {
                  const value = event[unionMember].headers[name]?.value;
                  if (value != null) {
                    if (member2.isNumericSchema()) {
                      if (value && typeof value === "object" && "bytes" in value) {
                        out[name] = BigInt(value.toString());
                      } else {
                        out[name] = Number(value);
                      }
                    } else {
                      out[name] = value;
                    }
                  }
                }
              }
              if (hasBindings) {
                return {
                  [unionMember]: out
                };
              }
              if (body.byteLength === 0) {
                return {
                  [unionMember]: {}
                };
              }
            }
            return {
              [unionMember]: await this.deserializer.read(eventStreamSchema, body)
            };
          } else {
            return {
              $unknown: event
            };
          }
        });
        const asyncIterator = asyncIterable[Symbol.asyncIterator]();
        const firstEvent = await asyncIterator.next();
        if (firstEvent.done) {
          return asyncIterable;
        }
        if (firstEvent.value?.[initialResponseMarker]) {
          if (!responseSchema) {
            throw new Error("@smithy::core/protocols - initial-response event encountered in event stream but no response schema given.");
          }
          for (const key in firstEvent.value) {
            initialResponseContainer[key] = firstEvent.value[key];
          }
        }
        return {
          async *[Symbol.asyncIterator]() {
            if (!firstEvent?.value?.[initialResponseMarker]) {
              yield firstEvent.value;
            }
            while (true) {
              const { done, value } = await asyncIterator.next();
              if (done) {
                break;
              }
              yield value;
            }
          }
        };
      }
      writeEventBody(unionMember, unionSchema, event) {
        const serializer = this.serializer;
        let eventType = unionMember;
        let explicitPayloadMember = null;
        let explicitPayloadContentType;
        const isKnownSchema = (() => {
          const struct = unionSchema.getSchema();
          return struct[4].includes(unionMember);
        })();
        const additionalHeaders = {};
        if (!isKnownSchema) {
          const [type, value] = event[unionMember];
          eventType = type;
          serializer.write(15, value);
        } else {
          const eventSchema = unionSchema.getMemberSchema(unionMember);
          if (eventSchema.isStructSchema()) {
            for (const [memberName, memberSchema] of eventSchema.structIterator()) {
              const { eventHeader, eventPayload } = memberSchema.getMergedTraits();
              if (eventPayload) {
                explicitPayloadMember = memberName;
              } else if (eventHeader) {
                const value = event[unionMember][memberName];
                let type = "binary";
                if (memberSchema.isNumericSchema()) {
                  if ((-2) ** 31 <= value && value <= 2 ** 31 - 1) {
                    type = "integer";
                  } else {
                    type = "long";
                  }
                } else if (memberSchema.isTimestampSchema()) {
                  type = "timestamp";
                } else if (memberSchema.isStringSchema()) {
                  type = "string";
                } else if (memberSchema.isBooleanSchema()) {
                  type = "boolean";
                }
                if (value != null) {
                  additionalHeaders[memberName] = {
                    type,
                    value
                  };
                  delete event[unionMember][memberName];
                }
              }
            }
            if (explicitPayloadMember !== null) {
              const payloadSchema = eventSchema.getMemberSchema(explicitPayloadMember);
              if (payloadSchema.isBlobSchema()) {
                explicitPayloadContentType = "application/octet-stream";
              } else if (payloadSchema.isStringSchema()) {
                explicitPayloadContentType = "text/plain";
              }
              serializer.write(payloadSchema, event[unionMember][explicitPayloadMember]);
            } else {
              serializer.write(eventSchema, event[unionMember]);
            }
          } else if (eventSchema.isUnitSchema()) {
            serializer.write(eventSchema, {});
          } else {
            throw new Error("@smithy/core/event-streams - non-struct member not supported in event stream union.");
          }
        }
        const messageSerialization = serializer.flush() ?? new Uint8Array();
        const body = typeof messageSerialization === "string" ? (this.serdeContext?.utf8Decoder ?? fromUtf8)(messageSerialization) : messageSerialization;
        return {
          body,
          eventType,
          explicitPayloadContentType,
          additionalHeaders
        };
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/event-streams/index.browser.js
var index_browser_exports = {};
__export(index_browser_exports, {
  EventStreamCodec: () => EventStreamCodec,
  EventStreamMarshaller: () => EventStreamMarshaller2,
  EventStreamSerde: () => EventStreamSerde,
  HeaderMarshaller: () => HeaderMarshaller,
  Int64: () => Int64,
  MessageDecoderStream: () => MessageDecoderStream,
  MessageEncoderStream: () => MessageEncoderStream,
  SmithyMessageDecoderStream: () => SmithyMessageDecoderStream,
  SmithyMessageEncoderStream: () => SmithyMessageEncoderStream,
  UniversalEventStreamMarshaller: () => EventStreamMarshaller,
  eventStreamSerdeProvider: () => eventStreamSerdeProvider2,
  getChunkedStream: () => getChunkedStream,
  getMessageUnmarshaller: () => getMessageUnmarshaller,
  getUnmarshalledStream: () => getUnmarshalledStream,
  iterableToReadableStream: () => iterableToReadableStream,
  readableStreamToIterable: () => readableStreamToIterable,
  resolveEventStreamSerdeConfig: () => resolveEventStreamSerdeConfig,
  universalEventStreamSerdeProvider: () => eventStreamSerdeProvider
});
var init_index_browser3 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/event-streams/index.browser.js"() {
    init_EventStreamCodec();
    init_HeaderMarshaller();
    init_Int64();
    init_MessageDecoderStream();
    init_MessageEncoderStream();
    init_SmithyMessageDecoderStream();
    init_SmithyMessageEncoderStream();
    init_EventStreamMarshaller_browser();
    init_utils();
    init_EventStreamMarshaller();
    init_getChunkedStream();
    init_getUnmarshalledStream();
    init_EventStreamSerdeConfig();
    init_EventStreamSerde();
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/HttpProtocol.js
var HttpProtocol;
var init_HttpProtocol = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/HttpProtocol.js"() {
    init_schema2();
    init_SerdeContext();
    init_httpRequest();
    init_httpResponse();
    HttpProtocol = class extends SerdeContext {
      static {
        __name(this, "HttpProtocol");
      }
      options;
      compositeErrorRegistry;
      constructor(options) {
        super();
        this.options = options;
        this.compositeErrorRegistry = TypeRegistry.for(options.defaultNamespace);
        for (const etr of options.errorTypeRegistries ?? []) {
          this.compositeErrorRegistry.copyFrom(etr);
        }
      }
      getRequestType() {
        return HttpRequest;
      }
      getResponseType() {
        return HttpResponse;
      }
      setSerdeContext(serdeContext) {
        this.serdeContext = serdeContext;
        this.serializer.setSerdeContext(serdeContext);
        this.deserializer.setSerdeContext(serdeContext);
        if (this.getPayloadCodec()) {
          this.getPayloadCodec().setSerdeContext(serdeContext);
        }
      }
      updateServiceEndpoint(request, endpoint) {
        if ("url" in endpoint) {
          request.protocol = endpoint.url.protocol;
          request.hostname = endpoint.url.hostname;
          request.port = endpoint.url.port ? Number(endpoint.url.port) : void 0;
          request.path = endpoint.url.pathname;
          request.fragment = endpoint.url.hash || void 0;
          request.username = endpoint.url.username || void 0;
          request.password = endpoint.url.password || void 0;
          if (!request.query) {
            request.query = {};
          }
          for (const [k2, v2] of endpoint.url.searchParams.entries()) {
            request.query[k2] = v2;
          }
          if (endpoint.headers) {
            for (const name in endpoint.headers) {
              request.headers[name] = endpoint.headers[name].join(", ");
            }
          }
          return request;
        } else {
          request.protocol = endpoint.protocol;
          request.hostname = endpoint.hostname;
          request.port = endpoint.port ? Number(endpoint.port) : void 0;
          request.path = endpoint.path;
          request.query = {
            ...endpoint.query
          };
          if (endpoint.headers) {
            for (const name in endpoint.headers) {
              request.headers[name] = endpoint.headers[name];
            }
          }
          return request;
        }
      }
      setHostPrefix(request, operationSchema, input) {
        if (this.serdeContext?.disableHostPrefix) {
          return;
        }
        const inputNs = NormalizedSchema.of(operationSchema.input);
        const opTraits = translateTraits(operationSchema.traits ?? {});
        if (opTraits.endpoint) {
          let hostPrefix = opTraits.endpoint?.[0];
          if (typeof hostPrefix === "string") {
            for (const [name, member2] of inputNs.structIterator()) {
              if (!member2.getMergedTraits().hostLabel) {
                continue;
              }
              const replacement = input[name];
              if (typeof replacement !== "string") {
                throw new Error(`@smithy/core/schema - ${name} in input must be a string as hostLabel.`);
              }
              hostPrefix = hostPrefix.replace(`{${name}}`, replacement);
            }
            request.hostname = hostPrefix + request.hostname;
          }
        }
      }
      deserializeMetadata(output) {
        return {
          httpStatusCode: output.statusCode,
          requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
          extendedRequestId: output.headers["x-amz-id-2"],
          cfId: output.headers["x-amz-cf-id"]
        };
      }
      async serializeEventStream({ eventStream, requestSchema, initialRequest }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.serializeEventStream({
          eventStream,
          requestSchema,
          initialRequest
        });
      }
      async deserializeEventStream({ response, responseSchema, initialResponseContainer }) {
        const eventStreamSerde = await this.loadEventStreamCapability();
        return eventStreamSerde.deserializeEventStream({
          response,
          responseSchema,
          initialResponseContainer
        });
      }
      async loadEventStreamCapability() {
        const { EventStreamSerde: EventStreamSerde2 } = await Promise.resolve().then(() => (init_index_browser3(), index_browser_exports));
        return new EventStreamSerde2({
          marshaller: this.getEventStreamMarshaller(),
          serializer: this.serializer,
          deserializer: this.deserializer,
          serdeContext: this.serdeContext,
          defaultContentType: this.getDefaultContentType()
        });
      }
      getDefaultContentType() {
        throw new Error(`@smithy/core/protocols - ${this.constructor.name} getDefaultContentType() implementation missing.`);
      }
      async deserializeHttpMessage(schema, context, response, arg4, arg5) {
        void schema;
        void context;
        void response;
        void arg4;
        void arg5;
        return [];
      }
      getEventStreamMarshaller() {
        const context = this.serdeContext;
        if (!context.eventStreamMarshaller) {
          throw new Error("@smithy/core - HttpProtocol: eventStreamMarshaller missing in serdeContext.");
        }
        return context.eventStreamMarshaller;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/HttpBindingProtocol.js
var HttpBindingProtocol;
var init_HttpBindingProtocol = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/HttpBindingProtocol.js"() {
    init_schema2();
    init_index_browser2();
    init_HttpProtocol();
    init_collect_stream_body();
    init_extended_encode_uri_component();
    init_httpRequest();
    HttpBindingProtocol = class extends HttpProtocol {
      static {
        __name(this, "HttpBindingProtocol");
      }
      async serializeRequest(operationSchema, _input, context) {
        const input = _input && typeof _input === "object" ? _input : {};
        const serializer = this.serializer;
        const query = {};
        const headers = {};
        const endpoint = await context.endpoint();
        const ns = NormalizedSchema.of(operationSchema?.input);
        const payloadMemberNames = [];
        const payloadMemberSchemas = [];
        let hasNonHttpBindingMember = false;
        let payload;
        const request = new HttpRequest({
          protocol: "",
          hostname: "",
          port: void 0,
          path: "",
          fragment: void 0,
          query,
          headers,
          body: void 0
        });
        if (endpoint) {
          this.updateServiceEndpoint(request, endpoint);
          this.setHostPrefix(request, operationSchema, input);
          const opTraits = translateTraits(operationSchema.traits);
          if (opTraits.http) {
            request.method = opTraits.http[0];
            const [path, search] = opTraits.http[1].split("?");
            if (request.path == "/") {
              request.path = path;
            } else {
              request.path += path;
            }
            const traitSearchParams = new URLSearchParams(search ?? "");
            for (const [key, value] of traitSearchParams) {
              query[key] = value;
            }
          }
        }
        for (const [memberName, memberNs] of ns.structIterator()) {
          const memberTraits = memberNs.getMergedTraits() ?? {};
          const inputMemberValue = input[memberName];
          if (inputMemberValue == null && !memberNs.isIdempotencyToken()) {
            if (memberTraits.httpLabel) {
              if (request.path.includes(`{${memberName}+}`) || request.path.includes(`{${memberName}}`)) {
                throw new Error(`No value provided for input HTTP label: ${memberName}.`);
              }
            }
            continue;
          }
          if (memberTraits.httpPayload) {
            const isStreaming2 = memberNs.isStreaming();
            if (isStreaming2) {
              const isEventStream = memberNs.isStructSchema();
              if (isEventStream) {
                if (input[memberName]) {
                  payload = await this.serializeEventStream({
                    eventStream: input[memberName],
                    requestSchema: ns
                  });
                }
              } else {
                payload = inputMemberValue;
              }
            } else {
              serializer.write(memberNs, inputMemberValue);
              payload = serializer.flush();
            }
          } else if (memberTraits.httpLabel) {
            serializer.write(memberNs, inputMemberValue);
            const replacement = serializer.flush();
            if (request.path.includes(`{${memberName}+}`)) {
              request.path = request.path.replace(`{${memberName}+}`, replacement.split("/").map(extendedEncodeURIComponent).join("/"));
            } else if (request.path.includes(`{${memberName}}`)) {
              request.path = request.path.replace(`{${memberName}}`, extendedEncodeURIComponent(replacement));
            }
          } else if (memberTraits.httpHeader) {
            serializer.write(memberNs, inputMemberValue);
            headers[memberTraits.httpHeader.toLowerCase()] = String(serializer.flush());
          } else if (typeof memberTraits.httpPrefixHeaders === "string") {
            for (const key in inputMemberValue) {
              const val = inputMemberValue[key];
              const amalgam = memberTraits.httpPrefixHeaders + key;
              serializer.write([memberNs.getValueSchema(), { httpHeader: amalgam }], val);
              headers[amalgam.toLowerCase()] = serializer.flush();
            }
          } else if (memberTraits.httpQuery || memberTraits.httpQueryParams) {
            this.serializeQuery(memberNs, inputMemberValue, query);
          } else {
            hasNonHttpBindingMember = true;
            payloadMemberNames.push(memberName);
            payloadMemberSchemas.push(memberNs);
          }
        }
        if (hasNonHttpBindingMember && input) {
          const [namespace, name] = (ns.getName(true) ?? "#Unknown").split("#");
          const requiredMembers = ns.getSchema()[6];
          const payloadSchema = [
            3,
            namespace,
            name,
            ns.getMergedTraits(),
            payloadMemberNames,
            payloadMemberSchemas,
            void 0
          ];
          if (requiredMembers) {
            payloadSchema[6] = requiredMembers;
          } else {
            payloadSchema.pop();
          }
          serializer.write(payloadSchema, input);
          payload = serializer.flush();
        }
        request.headers = headers;
        request.query = query;
        request.body = payload;
        return request;
      }
      serializeQuery(ns, data, query) {
        const serializer = this.serializer;
        const traits = ns.getMergedTraits();
        if (traits.httpQueryParams) {
          for (const key in data) {
            if (!(key in query)) {
              const val = data[key];
              const valueSchema = ns.getValueSchema();
              Object.assign(valueSchema.getMergedTraits(), {
                ...traits,
                httpQuery: key,
                httpQueryParams: void 0
              });
              this.serializeQuery(valueSchema, val, query);
            }
          }
          return;
        }
        if (ns.isListSchema()) {
          const sparse = !!ns.getMergedTraits().sparse;
          const buffer = [];
          for (const item of data) {
            serializer.write([ns.getValueSchema(), traits], item);
            const serializable = serializer.flush();
            if (sparse || serializable !== void 0) {
              buffer.push(serializable);
            }
          }
          query[traits.httpQuery] = buffer;
        } else {
          serializer.write([ns, traits], data);
          query[traits.httpQuery] = serializer.flush();
        }
      }
      async deserializeResponse(operationSchema, context, response) {
        const deserializer = this.deserializer;
        const ns = NormalizedSchema.of(operationSchema.output);
        const dataObject = {};
        if (response.statusCode >= 300) {
          const bytes = await collectBody(response.body, context);
          if (bytes.byteLength > 0) {
            Object.assign(dataObject, await deserializer.read(15, bytes));
          }
          await this.handleError(operationSchema, context, response, dataObject, this.deserializeMetadata(response));
          throw new Error("@smithy/core/protocols - HTTP Protocol error handler failed to throw.");
        }
        for (const header in response.headers) {
          const value = response.headers[header];
          delete response.headers[header];
          response.headers[header.toLowerCase()] = value;
        }
        const nonHttpBindingMembers = await this.deserializeHttpMessage(ns, context, response, dataObject);
        if (nonHttpBindingMembers.length) {
          const bytes = await collectBody(response.body, context);
          if (bytes.byteLength > 0) {
            const dataFromBody = await deserializer.read(ns, bytes);
            for (const member2 of nonHttpBindingMembers) {
              if (dataFromBody[member2] != null) {
                dataObject[member2] = dataFromBody[member2];
              }
            }
          }
        } else if (nonHttpBindingMembers.discardResponseBody) {
          await collectBody(response.body, context);
        }
        dataObject.$metadata = this.deserializeMetadata(response);
        return dataObject;
      }
      async deserializeHttpMessage(schema, context, response, arg4, arg5) {
        let dataObject;
        if (arg4 instanceof Set) {
          dataObject = arg5;
        } else {
          dataObject = arg4;
        }
        let discardResponseBody = true;
        const deserializer = this.deserializer;
        const ns = NormalizedSchema.of(schema);
        const nonHttpBindingMembers = [];
        for (const [memberName, memberSchema] of ns.structIterator()) {
          const memberTraits = memberSchema.getMemberTraits();
          if (memberTraits.httpPayload) {
            discardResponseBody = false;
            const isStreaming2 = memberSchema.isStreaming();
            if (isStreaming2) {
              const isEventStream = memberSchema.isStructSchema();
              if (isEventStream) {
                dataObject[memberName] = await this.deserializeEventStream({
                  response,
                  responseSchema: ns
                });
              } else {
                dataObject[memberName] = sdkStreamMixin(response.body);
              }
            } else if (response.body) {
              const bytes = await collectBody(response.body, context);
              if (bytes.byteLength > 0) {
                dataObject[memberName] = await deserializer.read(memberSchema, bytes);
              }
            }
          } else if (memberTraits.httpHeader) {
            const key = String(memberTraits.httpHeader).toLowerCase();
            const value = response.headers[key];
            if (null != value) {
              if (memberSchema.isListSchema()) {
                const headerListValueSchema = memberSchema.getValueSchema();
                headerListValueSchema.getMergedTraits().httpHeader = key;
                let sections;
                if (headerListValueSchema.isTimestampSchema() && headerListValueSchema.getSchema() === 4) {
                  sections = splitEvery(value, ",", 2);
                } else {
                  sections = splitHeader(value);
                }
                const list = [];
                for (const section of sections) {
                  list.push(await deserializer.read(headerListValueSchema, section.trim()));
                }
                dataObject[memberName] = list;
              } else {
                dataObject[memberName] = await deserializer.read(memberSchema, value);
              }
            }
          } else if (memberTraits.httpPrefixHeaders !== void 0) {
            dataObject[memberName] = {};
            for (const header in response.headers) {
              if (header.startsWith(memberTraits.httpPrefixHeaders)) {
                const value = response.headers[header];
                const valueSchema = memberSchema.getValueSchema();
                valueSchema.getMergedTraits().httpHeader = header;
                dataObject[memberName][header.slice(memberTraits.httpPrefixHeaders.length)] = await deserializer.read(valueSchema, value);
              }
            }
          } else if (memberTraits.httpResponseCode) {
            dataObject[memberName] = response.statusCode;
          } else {
            nonHttpBindingMembers.push(memberName);
          }
        }
        nonHttpBindingMembers.discardResponseBody = discardResponseBody;
        return nonHttpBindingMembers;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/RpcProtocol.js
var init_RpcProtocol = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/RpcProtocol.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/resolve-path.js
var init_resolve_path = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/resolve-path.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/requestBuilder.js
var init_requestBuilder = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/requestBuilder.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/serde/determineTimestampFormat.js
function determineTimestampFormat(ns, settings) {
  if (settings.timestampFormat.useTrait) {
    if (ns.isTimestampSchema() && (ns.getSchema() === 5 || ns.getSchema() === 6 || ns.getSchema() === 7)) {
      return ns.getSchema();
    }
  }
  const { httpLabel, httpPrefixHeaders, httpHeader, httpQuery } = ns.getMergedTraits();
  const bindingFormat = settings.httpBindings ? typeof httpPrefixHeaders === "string" || Boolean(httpHeader) ? 6 : Boolean(httpQuery) || Boolean(httpLabel) ? 5 : void 0 : void 0;
  return bindingFormat ?? settings.timestampFormat.default;
}
var init_determineTimestampFormat = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/serde/determineTimestampFormat.js"() {
    __name(determineTimestampFormat, "determineTimestampFormat");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/serde/FromStringShapeDeserializer.js
var FromStringShapeDeserializer;
var init_FromStringShapeDeserializer = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/serde/FromStringShapeDeserializer.js"() {
    init_schema2();
    init_index_browser2();
    init_SerdeContext();
    init_determineTimestampFormat();
    FromStringShapeDeserializer = class extends SerdeContext {
      static {
        __name(this, "FromStringShapeDeserializer");
      }
      settings;
      constructor(settings) {
        super();
        this.settings = settings;
      }
      read(_schema, data) {
        const ns = NormalizedSchema.of(_schema);
        if (ns.isListSchema()) {
          return splitHeader(data).map((item) => this.read(ns.getValueSchema(), item));
        }
        if (ns.isBlobSchema()) {
          return (this.serdeContext?.base64Decoder ?? fromBase64)(data);
        }
        if (ns.isTimestampSchema()) {
          const format2 = determineTimestampFormat(ns, this.settings);
          switch (format2) {
            case 5:
              return _parseRfc3339DateTimeWithOffset(data);
            case 6:
              return _parseRfc7231DateTime(data);
            case 7:
              return _parseEpochTimestamp(data);
            default:
              console.warn("Missing timestamp format, parsing value with Date constructor:", data);
              return new Date(data);
          }
        }
        if (ns.isStringSchema()) {
          const mediaType = ns.getMergedTraits().mediaType;
          let intermediateValue = data;
          if (mediaType) {
            if (ns.getMergedTraits().httpHeader) {
              intermediateValue = this.base64ToUtf8(intermediateValue);
            }
            const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
            if (isJson) {
              intermediateValue = LazyJsonString.from(intermediateValue);
            }
            return intermediateValue;
          }
        }
        if (ns.isNumericSchema()) {
          return Number(data);
        }
        if (ns.isBigIntegerSchema()) {
          return BigInt(data);
        }
        if (ns.isBigDecimalSchema()) {
          return new NumericValue(data, "bigDecimal");
        }
        if (ns.isBooleanSchema()) {
          return String(data).toLowerCase() === "true";
        }
        return data;
      }
      base64ToUtf8(base64String) {
        return (this.serdeContext?.utf8Encoder ?? toUtf8)((this.serdeContext?.base64Decoder ?? fromBase64)(base64String));
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/serde/HttpInterceptingShapeDeserializer.js
var HttpInterceptingShapeDeserializer;
var init_HttpInterceptingShapeDeserializer = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/serde/HttpInterceptingShapeDeserializer.js"() {
    init_schema2();
    init_index_browser2();
    init_SerdeContext();
    init_FromStringShapeDeserializer();
    HttpInterceptingShapeDeserializer = class extends SerdeContext {
      static {
        __name(this, "HttpInterceptingShapeDeserializer");
      }
      codecDeserializer;
      stringDeserializer;
      constructor(codecDeserializer, codecSettings) {
        super();
        this.codecDeserializer = codecDeserializer;
        this.stringDeserializer = new FromStringShapeDeserializer(codecSettings);
      }
      setSerdeContext(serdeContext) {
        this.stringDeserializer.setSerdeContext(serdeContext);
        this.codecDeserializer.setSerdeContext(serdeContext);
        this.serdeContext = serdeContext;
      }
      read(schema, data) {
        const ns = NormalizedSchema.of(schema);
        const traits = ns.getMergedTraits();
        const toString = this.serdeContext?.utf8Encoder ?? toUtf8;
        if (traits.httpHeader || traits.httpResponseCode) {
          return this.stringDeserializer.read(ns, toString(data));
        }
        if (traits.httpPayload) {
          if (ns.isBlobSchema()) {
            const toBytes = this.serdeContext?.utf8Decoder ?? fromUtf8;
            if (typeof data === "string") {
              return toBytes(data);
            }
            return data;
          } else if (ns.isStringSchema()) {
            if ("byteLength" in data) {
              return toString(data);
            }
            return data;
          }
        }
        return this.codecDeserializer.read(ns, data);
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/serde/ToStringShapeSerializer.js
var ToStringShapeSerializer;
var init_ToStringShapeSerializer = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/serde/ToStringShapeSerializer.js"() {
    init_schema2();
    init_index_browser2();
    init_SerdeContext();
    init_determineTimestampFormat();
    ToStringShapeSerializer = class extends SerdeContext {
      static {
        __name(this, "ToStringShapeSerializer");
      }
      settings;
      stringBuffer = "";
      constructor(settings) {
        super();
        this.settings = settings;
      }
      write(schema, value) {
        const ns = NormalizedSchema.of(schema);
        switch (typeof value) {
          case "object":
            if (value === null) {
              this.stringBuffer = "null";
              return;
            }
            if (ns.isTimestampSchema()) {
              if (!(value instanceof Date)) {
                throw new Error(`@smithy/core/protocols - received non-Date value ${value} when schema expected Date in ${ns.getName(true)}`);
              }
              const format2 = determineTimestampFormat(ns, this.settings);
              switch (format2) {
                case 5:
                  this.stringBuffer = value.toISOString().replace(".000Z", "Z");
                  break;
                case 6:
                  this.stringBuffer = dateToUtcString(value);
                  break;
                case 7:
                  this.stringBuffer = String(value.getTime() / 1e3);
                  break;
                default:
                  console.warn("Missing timestamp format, using epoch seconds", value);
                  this.stringBuffer = String(value.getTime() / 1e3);
              }
              return;
            }
            if (ns.isBlobSchema() && "byteLength" in value) {
              this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(value);
              return;
            }
            if (ns.isListSchema() && Array.isArray(value)) {
              let buffer = "";
              for (const item of value) {
                this.write([ns.getValueSchema(), ns.getMergedTraits()], item);
                const headerItem = this.flush();
                const serialized = ns.getValueSchema().isTimestampSchema() ? headerItem : quoteHeader(headerItem);
                if (buffer !== "") {
                  buffer += ", ";
                }
                buffer += serialized;
              }
              this.stringBuffer = buffer;
              return;
            }
            this.stringBuffer = JSON.stringify(value, null, 2);
            break;
          case "string":
            const mediaType = ns.getMergedTraits().mediaType;
            let intermediateValue = value;
            if (mediaType) {
              const isJson = mediaType === "application/json" || mediaType.endsWith("+json");
              if (isJson) {
                intermediateValue = LazyJsonString.from(intermediateValue);
              }
              if (ns.getMergedTraits().httpHeader) {
                this.stringBuffer = (this.serdeContext?.base64Encoder ?? toBase64)(intermediateValue.toString());
                return;
              }
            }
            this.stringBuffer = value;
            break;
          default:
            if (ns.isIdempotencyToken()) {
              this.stringBuffer = generateIdempotencyToken();
            } else {
              this.stringBuffer = String(value);
            }
        }
      }
      flush() {
        const buffer = this.stringBuffer;
        this.stringBuffer = "";
        return buffer;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/serde/HttpInterceptingShapeSerializer.js
var HttpInterceptingShapeSerializer;
var init_HttpInterceptingShapeSerializer = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/serde/HttpInterceptingShapeSerializer.js"() {
    init_schema2();
    init_ToStringShapeSerializer();
    HttpInterceptingShapeSerializer = class {
      static {
        __name(this, "HttpInterceptingShapeSerializer");
      }
      codecSerializer;
      stringSerializer;
      buffer;
      constructor(codecSerializer, codecSettings, stringSerializer = new ToStringShapeSerializer(codecSettings)) {
        this.codecSerializer = codecSerializer;
        this.stringSerializer = stringSerializer;
      }
      setSerdeContext(serdeContext) {
        this.codecSerializer.setSerdeContext(serdeContext);
        this.stringSerializer.setSerdeContext(serdeContext);
      }
      write(schema, value) {
        const ns = NormalizedSchema.of(schema);
        const traits = ns.getMergedTraits();
        if (traits.httpHeader || traits.httpLabel || traits.httpQuery) {
          this.stringSerializer.write(ns, value);
          this.buffer = this.stringSerializer.flush();
          return;
        }
        return this.codecSerializer.write(ns, value);
      }
      flush() {
        if (this.buffer !== void 0) {
          const buffer = this.buffer;
          this.buffer = void 0;
          return buffer;
        }
        return this.codecSerializer.flush();
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/extensions/httpExtensionConfiguration.js
var getHttpHandlerExtensionConfiguration, resolveHttpHandlerRuntimeConfig;
var init_httpExtensionConfiguration = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/protocol-http/extensions/httpExtensionConfiguration.js"() {
    getHttpHandlerExtensionConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
      return {
        setHttpHandler(handler) {
          runtimeConfig.httpHandler = handler;
        },
        httpHandler() {
          return runtimeConfig.httpHandler;
        },
        updateHttpClientConfig(key, value) {
          runtimeConfig.httpHandler?.updateHttpClientConfig(key, value);
        },
        httpHandlerConfigs() {
          return runtimeConfig.httpHandler.httpHandlerConfigs();
        }
      };
    }, "getHttpHandlerExtensionConfiguration");
    resolveHttpHandlerRuntimeConfig = /* @__PURE__ */ __name((httpHandlerExtensionConfiguration) => {
      return {
        httpHandler: httpHandlerExtensionConfiguration.httpHandler()
      };
    }, "resolveHttpHandlerRuntimeConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/middleware-content-length/contentLengthMiddleware.js
function contentLengthMiddleware(bodyLengthChecker) {
  return (next) => async (args) => {
    const request = args.request;
    if (HttpRequest.isInstance(request)) {
      const { body, headers } = request;
      if (body && Object.keys(headers).map((str) => str.toLowerCase()).indexOf(CONTENT_LENGTH_HEADER) === -1) {
        try {
          const length = bodyLengthChecker(body);
          request.headers = {
            ...request.headers,
            [CONTENT_LENGTH_HEADER]: String(length)
          };
        } catch (error) {
        }
      }
    }
    return next({
      ...args,
      request
    });
  };
}
var CONTENT_LENGTH_HEADER, contentLengthMiddlewareOptions, getContentLengthPlugin;
var init_contentLengthMiddleware = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/middleware-content-length/contentLengthMiddleware.js"() {
    init_httpRequest();
    CONTENT_LENGTH_HEADER = "content-length";
    __name(contentLengthMiddleware, "contentLengthMiddleware");
    contentLengthMiddlewareOptions = {
      step: "build",
      tags: ["SET_CONTENT_LENGTH", "CONTENT_LENGTH"],
      name: "contentLengthMiddleware",
      override: true
    };
    getContentLengthPlugin = /* @__PURE__ */ __name((options) => ({
      applyToStack: /* @__PURE__ */ __name((clientStack) => {
        clientStack.add(contentLengthMiddleware(options.bodyLengthChecker), contentLengthMiddlewareOptions);
      }, "applyToStack")
    }), "getContentLengthPlugin");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/util-uri-escape/escape-uri.js
var escapeUri, hexEncode;
var init_escape_uri = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/util-uri-escape/escape-uri.js"() {
    escapeUri = /* @__PURE__ */ __name((uri) => encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode), "escapeUri");
    hexEncode = /* @__PURE__ */ __name((c2) => `%${c2.charCodeAt(0).toString(16).toUpperCase()}`, "hexEncode");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/querystring-builder/buildQueryString.js
function buildQueryString(query) {
  const parts = [];
  for (let key of Object.keys(query).sort()) {
    const value = query[key];
    key = escapeUri(key);
    if (Array.isArray(value)) {
      for (let i2 = 0, iLen = value.length; i2 < iLen; i2++) {
        parts.push(`${key}=${escapeUri(value[i2])}`);
      }
    } else {
      let qsEntry = key;
      if (value || typeof value === "string") {
        qsEntry += `=${escapeUri(value)}`;
      }
      parts.push(qsEntry);
    }
  }
  return parts.join("&");
}
var init_buildQueryString = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/querystring-builder/buildQueryString.js"() {
    init_escape_uri();
    __name(buildQueryString, "buildQueryString");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/querystring-parser/parseQueryString.js
function parseQueryString(querystring) {
  const query = {};
  querystring = querystring.replace(/^\?/, "");
  if (querystring) {
    for (const pair of querystring.split("&")) {
      let [key, value = null] = pair.split("=");
      key = decodeURIComponent(key);
      if (value) {
        value = decodeURIComponent(value);
      }
      if (!(key in query)) {
        query[key] = value;
      } else if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    }
  }
  return query;
}
var init_parseQueryString = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/querystring-parser/parseQueryString.js"() {
    __name(parseQueryString, "parseQueryString");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/url-parser/parseUrl.js
var parseUrl;
var init_parseUrl = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/url-parser/parseUrl.js"() {
    init_parseQueryString();
    parseUrl = /* @__PURE__ */ __name((url) => {
      if (typeof url === "string") {
        return parseUrl(new URL(url));
      }
      const { hostname, pathname, port, protocol, search } = url;
      let query;
      if (search) {
        query = parseQueryString(search);
      }
      return {
        hostname,
        port: port ? parseInt(port) : void 0,
        protocol,
        path: pathname,
        query
      };
    }, "parseUrl");
  }
});

// node_modules/@smithy/core/dist-es/submodules/protocols/index.js
var init_protocols = __esm({
  "node_modules/@smithy/core/dist-es/submodules/protocols/index.js"() {
    init_collect_stream_body();
    init_extended_encode_uri_component();
    init_HttpBindingProtocol();
    init_HttpProtocol();
    init_RpcProtocol();
    init_requestBuilder();
    init_resolve_path();
    init_FromStringShapeDeserializer();
    init_HttpInterceptingShapeDeserializer();
    init_HttpInterceptingShapeSerializer();
    init_ToStringShapeSerializer();
    init_determineTimestampFormat();
    init_SerdeContext();
    init_httpRequest();
    init_httpResponse();
    init_httpExtensionConfiguration();
    init_contentLengthMiddleware();
    init_escape_uri();
    init_buildQueryString();
    init_parseUrl();
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/operation.js
var operation;
var init_operation = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/operation.js"() {
    operation = /* @__PURE__ */ __name((namespace, name, traits, input, output) => ({
      name,
      namespace,
      traits,
      input,
      output
    }), "operation");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/middleware/schemaDeserializationMiddleware.js
var schemaDeserializationMiddleware, findHeader;
var init_schemaDeserializationMiddleware = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/middleware/schemaDeserializationMiddleware.js"() {
    init_client3();
    init_protocols();
    init_operation();
    schemaDeserializationMiddleware = /* @__PURE__ */ __name((config) => (next, context) => async (args) => {
      const { response } = await next(args);
      const { operationSchema } = getSmithyContext(context);
      const [, ns, n2, t8, i2, o2] = operationSchema ?? [];
      try {
        const parsed = await config.protocol.deserializeResponse(operation(ns, n2, t8, i2, o2), {
          ...config,
          ...context
        }, response);
        return {
          response,
          output: parsed
        };
      } catch (error) {
        Object.defineProperty(error, "$response", {
          value: response,
          enumerable: false,
          writable: false,
          configurable: false
        });
        if (!("$metadata" in error)) {
          const hint = `Deserialization error: to see the raw response, inspect the hidden field {error}.$response on this object.`;
          try {
            error.message += "\n  " + hint;
          } catch (e2) {
            if (!context.logger || context.logger?.constructor?.name === "NoOpLogger") {
              console.warn(hint);
            } else {
              context.logger?.warn?.(hint);
            }
          }
          if (typeof error.$responseBodyText !== "undefined") {
            if (error.$response) {
              error.$response.body = error.$responseBodyText;
            }
          }
          try {
            if (HttpResponse.isInstance(response)) {
              const { headers = {} } = response;
              const headerEntries = Object.entries(headers);
              error.$metadata = {
                httpStatusCode: response.statusCode,
                requestId: findHeader(/^x-[\w-]+-request-?id$/, headerEntries),
                extendedRequestId: findHeader(/^x-[\w-]+-id-2$/, headerEntries),
                cfId: findHeader(/^x-[\w-]+-cf-id$/, headerEntries)
              };
            }
          } catch (e2) {
          }
        }
        throw error;
      }
    }, "schemaDeserializationMiddleware");
    findHeader = /* @__PURE__ */ __name((pattern, headers) => {
      return (headers.find(([k2]) => {
        return k2.match(pattern);
      }) || [void 0, void 0])[1];
    }, "findHeader");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/middleware/schemaSerializationMiddleware.js
var schemaSerializationMiddleware;
var init_schemaSerializationMiddleware = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/middleware/schemaSerializationMiddleware.js"() {
    init_client3();
    init_index_browser();
    init_operation();
    schemaSerializationMiddleware = /* @__PURE__ */ __name((config) => (next, context) => async (args) => {
      const { operationSchema } = getSmithyContext(context);
      const [, ns, n2, t8, i2, o2] = operationSchema ?? [];
      const endpoint = context.endpointV2 ? async () => toEndpointV1(context.endpointV2) : config.endpoint;
      const request = await config.protocol.serializeRequest(operation(ns, n2, t8, i2, o2), args.input, {
        ...config,
        ...context,
        endpoint
      });
      return next({
        ...args,
        request
      });
    }, "schemaSerializationMiddleware");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/middleware/getSchemaSerdePlugin.js
function getSchemaSerdePlugin(config) {
  return {
    applyToStack: /* @__PURE__ */ __name((commandStack) => {
      commandStack.add(schemaSerializationMiddleware(config), serializerMiddlewareOption2);
      commandStack.add(schemaDeserializationMiddleware(config), deserializerMiddlewareOption);
      config.protocol.setSerdeContext(config);
    }, "applyToStack")
  };
}
var deserializerMiddlewareOption, serializerMiddlewareOption2;
var init_getSchemaSerdePlugin = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/middleware/getSchemaSerdePlugin.js"() {
    init_schemaDeserializationMiddleware();
    init_schemaSerializationMiddleware();
    deserializerMiddlewareOption = {
      name: "deserializerMiddleware",
      step: "deserialize",
      tags: ["DESERIALIZER"],
      override: true
    };
    serializerMiddlewareOption2 = {
      name: "serializerMiddleware",
      step: "serialize",
      tags: ["SERIALIZER"],
      override: true
    };
    __name(getSchemaSerdePlugin, "getSchemaSerdePlugin");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/Schema.js
var init_Schema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/Schema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/ListSchema.js
var init_ListSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/ListSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/MapSchema.js
var init_MapSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/MapSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/OperationSchema.js
var init_OperationSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/OperationSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/StructureSchema.js
var init_StructureSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/StructureSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/ErrorSchema.js
var init_ErrorSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/ErrorSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/translateTraits.js
function translateTraits(indicator) {
  if (typeof indicator === "object") {
    return indicator;
  }
  indicator = indicator | 0;
  if (traitsCache[indicator]) {
    return traitsCache[indicator];
  }
  const traits = {};
  let i2 = 0;
  for (const trait of [
    "httpLabel",
    "idempotent",
    "idempotencyToken",
    "sensitive",
    "httpPayload",
    "httpResponseCode",
    "httpQueryParams"
  ]) {
    if ((indicator >> i2++ & 1) === 1) {
      traits[trait] = 1;
    }
  }
  return traitsCache[indicator] = traits;
}
var traitsCache;
var init_translateTraits = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/translateTraits.js"() {
    traitsCache = [];
    __name(translateTraits, "translateTraits");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/NormalizedSchema.js
function member(memberSchema, memberName) {
  if (memberSchema instanceof NormalizedSchema) {
    return Object.assign(memberSchema, {
      memberName,
      _isMemberSchema: true
    });
  }
  const internalCtorAccess = NormalizedSchema;
  return new internalCtorAccess(memberSchema, memberName);
}
var anno, simpleSchemaCacheN, simpleSchemaCacheS, NormalizedSchema, isMemberSchema, isStaticSchema;
var init_NormalizedSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/NormalizedSchema.js"() {
    init_deref();
    init_translateTraits();
    anno = {
      it: /* @__PURE__ */ Symbol.for("@smithy/nor-struct-it"),
      ns: /* @__PURE__ */ Symbol.for("@smithy/ns")
    };
    simpleSchemaCacheN = [];
    simpleSchemaCacheS = {};
    NormalizedSchema = class _NormalizedSchema {
      static {
        __name(this, "NormalizedSchema");
      }
      ref;
      memberName;
      static symbol = /* @__PURE__ */ Symbol.for("@smithy/nor");
      symbol = _NormalizedSchema.symbol;
      name;
      schema;
      _isMemberSchema;
      traits;
      memberTraits;
      normalizedTraits;
      constructor(ref, memberName) {
        this.ref = ref;
        this.memberName = memberName;
        const traitStack = [];
        let _ref = ref;
        let schema = ref;
        this._isMemberSchema = false;
        while (isMemberSchema(_ref)) {
          traitStack.push(_ref[1]);
          _ref = _ref[0];
          schema = deref(_ref);
          this._isMemberSchema = true;
        }
        if (traitStack.length > 0) {
          this.memberTraits = {};
          for (let i2 = traitStack.length - 1; i2 >= 0; --i2) {
            const traitSet = traitStack[i2];
            Object.assign(this.memberTraits, translateTraits(traitSet));
          }
        } else {
          this.memberTraits = 0;
        }
        if (schema instanceof _NormalizedSchema) {
          const computedMemberTraits = this.memberTraits;
          Object.assign(this, schema);
          this.memberTraits = Object.assign({}, computedMemberTraits, schema.getMemberTraits(), this.getMemberTraits());
          this.normalizedTraits = void 0;
          this.memberName = memberName ?? schema.memberName;
          return;
        }
        this.schema = deref(schema);
        if (isStaticSchema(this.schema)) {
          this.name = `${this.schema[1]}#${this.schema[2]}`;
          this.traits = this.schema[3];
        } else {
          this.name = this.memberName ?? String(schema);
          this.traits = 0;
        }
        if (this._isMemberSchema && !memberName) {
          throw new Error(`@smithy/core/schema - NormalizedSchema member init ${this.getName(true)} missing member name.`);
        }
      }
      static [Symbol.hasInstance](lhs) {
        const isPrototype = this.prototype.isPrototypeOf(lhs);
        if (!isPrototype && typeof lhs === "object" && lhs !== null) {
          const ns = lhs;
          return ns.symbol === this.symbol;
        }
        return isPrototype;
      }
      static of(ref) {
        const keyAble = typeof ref === "function" || typeof ref === "object" && ref !== null;
        if (typeof ref === "number") {
          if (simpleSchemaCacheN[ref]) {
            return simpleSchemaCacheN[ref];
          }
        } else if (typeof ref === "string") {
          if (simpleSchemaCacheS[ref]) {
            return simpleSchemaCacheS[ref];
          }
        } else if (keyAble) {
          if (ref[anno.ns]) {
            return ref[anno.ns];
          }
        }
        const sc = deref(ref);
        if (sc instanceof _NormalizedSchema) {
          return sc;
        }
        if (isMemberSchema(sc)) {
          const [ns2, traits] = sc;
          if (ns2 instanceof _NormalizedSchema) {
            Object.assign(ns2.getMergedTraits(), translateTraits(traits));
            return ns2;
          }
          throw new Error(`@smithy/core/schema - may not init unwrapped member schema=${JSON.stringify(ref, null, 2)}.`);
        }
        const ns = new _NormalizedSchema(sc);
        if (keyAble) {
          return ref[anno.ns] = ns;
        }
        if (typeof sc === "string") {
          return simpleSchemaCacheS[sc] = ns;
        }
        if (typeof sc === "number") {
          return simpleSchemaCacheN[sc] = ns;
        }
        return ns;
      }
      getSchema() {
        const sc = this.schema;
        if (Array.isArray(sc) && sc[0] === 0) {
          return sc[4];
        }
        return sc;
      }
      getName(withNamespace = false) {
        const { name } = this;
        const short = !withNamespace && name && name.includes("#");
        return short ? name.split("#")[1] : name || void 0;
      }
      getMemberName() {
        return this.memberName;
      }
      isMemberSchema() {
        return this._isMemberSchema;
      }
      isListSchema() {
        const sc = this.getSchema();
        return typeof sc === "number" ? sc >= 64 && sc < 128 : sc[0] === 1;
      }
      isMapSchema() {
        const sc = this.getSchema();
        return typeof sc === "number" ? sc >= 128 && sc <= 255 : sc[0] === 2;
      }
      isStructSchema() {
        const sc = this.getSchema();
        if (typeof sc !== "object") {
          return false;
        }
        const id = sc[0];
        return id === 3 || id === -3 || id === 4;
      }
      isUnionSchema() {
        const sc = this.getSchema();
        if (typeof sc !== "object") {
          return false;
        }
        return sc[0] === 4;
      }
      isBlobSchema() {
        const sc = this.getSchema();
        return sc === 21 || sc === 42;
      }
      isTimestampSchema() {
        const sc = this.getSchema();
        return typeof sc === "number" && sc >= 4 && sc <= 7;
      }
      isUnitSchema() {
        return this.getSchema() === "unit";
      }
      isDocumentSchema() {
        return this.getSchema() === 15;
      }
      isStringSchema() {
        return this.getSchema() === 0;
      }
      isBooleanSchema() {
        return this.getSchema() === 2;
      }
      isNumericSchema() {
        return this.getSchema() === 1;
      }
      isBigIntegerSchema() {
        return this.getSchema() === 17;
      }
      isBigDecimalSchema() {
        return this.getSchema() === 19;
      }
      isStreaming() {
        const { streaming } = this.getMergedTraits();
        return !!streaming || this.getSchema() === 42;
      }
      isIdempotencyToken() {
        return !!this.getMergedTraits().idempotencyToken;
      }
      getMergedTraits() {
        return this.normalizedTraits ?? (this.normalizedTraits = {
          ...this.getOwnTraits(),
          ...this.getMemberTraits()
        });
      }
      getMemberTraits() {
        return translateTraits(this.memberTraits);
      }
      getOwnTraits() {
        return translateTraits(this.traits);
      }
      getKeySchema() {
        const [isDoc, isMap] = [this.isDocumentSchema(), this.isMapSchema()];
        if (!isDoc && !isMap) {
          throw new Error(`@smithy/core/schema - cannot get key for non-map: ${this.getName(true)}`);
        }
        const schema = this.getSchema();
        const memberSchema = isDoc ? 15 : schema[4] ?? 0;
        return member([memberSchema, 0], "key");
      }
      getValueSchema() {
        const sc = this.getSchema();
        const [isDoc, isMap, isList] = [this.isDocumentSchema(), this.isMapSchema(), this.isListSchema()];
        const memberSchema = typeof sc === "number" ? 63 & sc : sc && typeof sc === "object" && (isMap || isList) ? sc[3 + sc[0]] : isDoc ? 15 : void 0;
        if (memberSchema != null) {
          return member([memberSchema, 0], isMap ? "value" : "member");
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no value member.`);
      }
      getMemberSchema(memberName) {
        const struct = this.getSchema();
        if (this.isStructSchema() && struct[4].includes(memberName)) {
          const i2 = struct[4].indexOf(memberName);
          const memberSchema = struct[5][i2];
          return member(isMemberSchema(memberSchema) ? memberSchema : [memberSchema, 0], memberName);
        }
        if (this.isDocumentSchema()) {
          return member([15, 0], memberName);
        }
        throw new Error(`@smithy/core/schema - ${this.getName(true)} has no member=${memberName}.`);
      }
      getMemberSchemas() {
        const buffer = {};
        try {
          for (const [k2, v2] of this.structIterator()) {
            buffer[k2] = v2;
          }
        } catch (ignored) {
        }
        return buffer;
      }
      getEventStreamMember() {
        if (this.isStructSchema()) {
          for (const [memberName, memberSchema] of this.structIterator()) {
            if (memberSchema.isStreaming() && memberSchema.isStructSchema()) {
              return memberName;
            }
          }
        }
        return "";
      }
      *structIterator() {
        if (this.isUnitSchema()) {
          return;
        }
        if (!this.isStructSchema()) {
          throw new Error("@smithy/core/schema - cannot iterate non-struct schema.");
        }
        const struct = this.getSchema();
        const z2 = struct[4].length;
        let it = struct[anno.it];
        if (it && z2 === it.length) {
          yield* it;
          return;
        }
        it = Array(z2);
        for (let i2 = 0; i2 < z2; ++i2) {
          const k2 = struct[4][i2];
          const v2 = member([struct[5][i2], 0], k2);
          yield it[i2] = [k2, v2];
        }
        struct[anno.it] = it;
      }
    };
    __name(member, "member");
    isMemberSchema = /* @__PURE__ */ __name((sc) => Array.isArray(sc) && sc.length === 2, "isMemberSchema");
    isStaticSchema = /* @__PURE__ */ __name((sc) => Array.isArray(sc) && sc.length >= 5, "isStaticSchema");
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/SimpleSchema.js
var init_SimpleSchema = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/SimpleSchema.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/schemas/sentinels.js
var init_sentinels2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/schemas/sentinels.js"() {
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/TypeRegistry.js
var TypeRegistry;
var init_TypeRegistry = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/TypeRegistry.js"() {
    TypeRegistry = class _TypeRegistry {
      static {
        __name(this, "TypeRegistry");
      }
      namespace;
      schemas;
      exceptions;
      static registries = /* @__PURE__ */ new Map();
      constructor(namespace, schemas = /* @__PURE__ */ new Map(), exceptions = /* @__PURE__ */ new Map()) {
        this.namespace = namespace;
        this.schemas = schemas;
        this.exceptions = exceptions;
      }
      static for(namespace) {
        if (!_TypeRegistry.registries.has(namespace)) {
          _TypeRegistry.registries.set(namespace, new _TypeRegistry(namespace));
        }
        return _TypeRegistry.registries.get(namespace);
      }
      copyFrom(other) {
        const { schemas, exceptions } = this;
        for (const [k2, v2] of other.schemas) {
          if (!schemas.has(k2)) {
            schemas.set(k2, v2);
          }
        }
        for (const [k2, v2] of other.exceptions) {
          if (!exceptions.has(k2)) {
            exceptions.set(k2, v2);
          }
        }
      }
      register(shapeId, schema) {
        const qualifiedName = this.normalizeShapeId(shapeId);
        for (const r2 of [this, _TypeRegistry.for(qualifiedName.split("#")[0])]) {
          r2.schemas.set(qualifiedName, schema);
        }
      }
      getSchema(shapeId) {
        const id = this.normalizeShapeId(shapeId);
        if (!this.schemas.has(id)) {
          if (!shapeId.includes("#")) {
            const suffix = "#" + shapeId;
            const candidates = [];
            for (const [shapeId2, schema] of this.schemas.entries()) {
              if (shapeId2.endsWith(suffix)) {
                candidates.push(schema);
              }
            }
            if (candidates.length === 1) {
              return candidates[0];
            }
          }
          throw new Error(`@smithy/core/schema - schema not found for ${id}`);
        }
        return this.schemas.get(id);
      }
      registerError(es, ctor) {
        const $error = es;
        const ns = $error[1];
        for (const r2 of [this, _TypeRegistry.for(ns)]) {
          r2.schemas.set(ns + "#" + $error[2], $error);
          r2.exceptions.set($error, ctor);
        }
      }
      getErrorCtor(es) {
        const $error = es;
        if (this.exceptions.has($error)) {
          return this.exceptions.get($error);
        }
        const registry = _TypeRegistry.for($error[1]);
        return registry.exceptions.get($error);
      }
      getBaseException() {
        for (const exceptionKey of this.exceptions.keys()) {
          if (Array.isArray(exceptionKey)) {
            const [, ns, name] = exceptionKey;
            const id = ns + "#" + name;
            if (id.startsWith("smithy.ts.sdk.synthetic.") && id.endsWith("ServiceException")) {
              return exceptionKey;
            }
          }
        }
        return void 0;
      }
      find(predicate) {
        for (const schema of this.schemas.values()) {
          if (predicate(schema)) {
            return schema;
          }
        }
        return void 0;
      }
      clear() {
        this.schemas.clear();
        this.exceptions.clear();
      }
      normalizeShapeId(shapeId) {
        if (shapeId.includes("#")) {
          return shapeId;
        }
        return this.namespace + "#" + shapeId;
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/schema/index.js
var init_schema2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/schema/index.js"() {
    init_deref();
    init_getSchemaSerdePlugin();
    init_ListSchema();
    init_MapSchema();
    init_OperationSchema();
    init_operation();
    init_ErrorSchema();
    init_NormalizedSchema();
    init_Schema();
    init_SimpleSchema();
    init_StructureSchema();
    init_sentinels2();
    init_translateTraits();
    init_TypeRegistry();
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/schemaLogFilter.js
function schemaLogFilter(schema, data) {
  if (data == null) {
    return data;
  }
  const ns = NormalizedSchema.of(schema);
  if (ns.getMergedTraits().sensitive) {
    return SENSITIVE_STRING;
  }
  if (ns.isListSchema()) {
    const isSensitive = !!ns.getValueSchema().getMergedTraits().sensitive;
    if (isSensitive) {
      return SENSITIVE_STRING;
    }
  } else if (ns.isMapSchema()) {
    const isSensitive = !!ns.getKeySchema().getMergedTraits().sensitive || !!ns.getValueSchema().getMergedTraits().sensitive;
    if (isSensitive) {
      return SENSITIVE_STRING;
    }
  } else if (ns.isStructSchema() && typeof data === "object") {
    const object = data;
    const newObject = {};
    for (const [member2, memberNs] of ns.structIterator()) {
      if (object[member2] != null) {
        newObject[member2] = schemaLogFilter(memberNs, object[member2]);
      }
    }
    return newObject;
  }
  return data;
}
var SENSITIVE_STRING;
var init_schemaLogFilter = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/schemaLogFilter.js"() {
    init_schema2();
    SENSITIVE_STRING = "***SensitiveInformation***";
    __name(schemaLogFilter, "schemaLogFilter");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/command.js
var Command, ClassBuilder;
var init_command2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/command.js"() {
    init_dist_es();
    init_MiddlewareStack();
    init_schemaLogFilter();
    Command = class {
      static {
        __name(this, "Command");
      }
      middlewareStack = constructStack();
      schema;
      static classBuilder() {
        return new ClassBuilder();
      }
      resolveMiddlewareWithContext(clientStack, configuration, options, { middlewareFn, clientName, commandName, inputFilterSensitiveLog, outputFilterSensitiveLog, smithyContext, additionalContext, CommandCtor }) {
        for (const mw of middlewareFn.bind(this)(CommandCtor, clientStack, configuration, options)) {
          this.middlewareStack.use(mw);
        }
        const stack = clientStack.concat(this.middlewareStack);
        const { logger: logger2 } = configuration;
        const handlerExecutionContext = {
          logger: logger2,
          clientName,
          commandName,
          inputFilterSensitiveLog,
          outputFilterSensitiveLog,
          [SMITHY_CONTEXT_KEY]: {
            commandInstance: this,
            ...smithyContext
          },
          ...additionalContext
        };
        const { requestHandler } = configuration;
        let requestOptions = options ?? {};
        if (smithyContext.eventStream) {
          requestOptions = {
            isEventStream: true,
            ...requestOptions
          };
        }
        return stack.resolve((request) => requestHandler.handle(request.request, requestOptions), handlerExecutionContext);
      }
    };
    ClassBuilder = class {
      static {
        __name(this, "ClassBuilder");
      }
      _init = /* @__PURE__ */ __name(() => {
      }, "_init");
      _ep = {};
      _middlewareFn = /* @__PURE__ */ __name(() => [], "_middlewareFn");
      _commandName = "";
      _clientName = "";
      _additionalContext = {};
      _smithyContext = {};
      _inputFilterSensitiveLog = void 0;
      _outputFilterSensitiveLog = void 0;
      _serializer = null;
      _deserializer = null;
      _operationSchema;
      init(cb) {
        this._init = cb;
      }
      ep(endpointParameterInstructions) {
        this._ep = endpointParameterInstructions;
        return this;
      }
      m(middlewareSupplier) {
        this._middlewareFn = middlewareSupplier;
        return this;
      }
      s(service, operation2, smithyContext = {}) {
        this._smithyContext = {
          service,
          operation: operation2,
          ...smithyContext
        };
        return this;
      }
      c(additionalContext = {}) {
        this._additionalContext = additionalContext;
        return this;
      }
      n(clientName, commandName) {
        this._clientName = clientName;
        this._commandName = commandName;
        return this;
      }
      f(inputFilter = (_) => _, outputFilter = (_) => _) {
        this._inputFilterSensitiveLog = inputFilter;
        this._outputFilterSensitiveLog = outputFilter;
        return this;
      }
      ser(serializer) {
        this._serializer = serializer;
        return this;
      }
      de(deserializer) {
        this._deserializer = deserializer;
        return this;
      }
      sc(operation2) {
        this._operationSchema = operation2;
        this._smithyContext.operationSchema = operation2;
        return this;
      }
      build() {
        const closure = this;
        let CommandRef;
        return CommandRef = class extends Command {
          static {
            __name(this, "CommandRef");
          }
          input;
          static getEndpointParameterInstructions() {
            return closure._ep;
          }
          constructor(...[input]) {
            super();
            this.input = input ?? {};
            closure._init(this);
            this.schema = closure._operationSchema;
          }
          resolveMiddleware(stack, configuration, options) {
            const op = closure._operationSchema;
            const input = op?.[4] ?? op?.input;
            const output = op?.[5] ?? op?.output;
            return this.resolveMiddlewareWithContext(stack, configuration, options, {
              CommandCtor: CommandRef,
              middlewareFn: closure._middlewareFn,
              clientName: closure._clientName,
              commandName: closure._commandName,
              inputFilterSensitiveLog: closure._inputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, input) : (_) => _),
              outputFilterSensitiveLog: closure._outputFilterSensitiveLog ?? (op ? schemaLogFilter.bind(null, output) : (_) => _),
              smithyContext: closure._smithyContext,
              additionalContext: closure._additionalContext
            });
          }
          serialize = closure._serializer;
          deserialize = closure._deserializer;
        };
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/exceptions.js
var ServiceException, decorateServiceException;
var init_exceptions = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/exceptions.js"() {
    ServiceException = class _ServiceException extends Error {
      static {
        __name(this, "ServiceException");
      }
      $fault;
      $response;
      $retryable;
      $metadata;
      constructor(options) {
        super(options.message);
        Object.setPrototypeOf(this, Object.getPrototypeOf(this).constructor.prototype);
        this.name = options.name;
        this.$fault = options.$fault;
        this.$metadata = options.$metadata;
      }
      static isInstance(value) {
        if (!value)
          return false;
        const candidate = value;
        return _ServiceException.prototype.isPrototypeOf(candidate) || Boolean(candidate.$fault) && Boolean(candidate.$metadata) && (candidate.$fault === "client" || candidate.$fault === "server");
      }
      static [Symbol.hasInstance](instance) {
        if (!instance)
          return false;
        const candidate = instance;
        if (this === _ServiceException) {
          return _ServiceException.isInstance(instance);
        }
        if (_ServiceException.isInstance(instance)) {
          if (candidate.name && this.name) {
            return this.prototype.isPrototypeOf(instance) || candidate.name === this.name;
          }
          return this.prototype.isPrototypeOf(instance);
        }
        return false;
      }
    };
    decorateServiceException = /* @__PURE__ */ __name((exception, additions = {}) => {
      Object.entries(additions).filter(([, v2]) => v2 !== void 0).forEach(([k2, v2]) => {
        if (exception[k2] == void 0 || exception[k2] === "") {
          exception[k2] = v2;
        }
      });
      const message = exception.message || exception.Message || "UnknownError";
      exception.message = message;
      delete exception.Message;
      return exception;
    }, "decorateServiceException");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/defaults-mode.js
var loadConfigsForDefaultMode;
var init_defaults_mode = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/defaults-mode.js"() {
    loadConfigsForDefaultMode = /* @__PURE__ */ __name((mode) => {
      switch (mode) {
        case "standard":
          return {
            retryMode: "standard",
            connectionTimeout: 3100
          };
        case "in-region":
          return {
            retryMode: "standard",
            connectionTimeout: 1100
          };
        case "cross-region":
          return {
            retryMode: "standard",
            connectionTimeout: 3100
          };
        case "mobile":
          return {
            retryMode: "standard",
            connectionTimeout: 3e4
          };
        default:
          return {};
      }
    }, "loadConfigsForDefaultMode");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/checksum.js
var knownAlgorithms, getChecksumConfiguration, resolveChecksumRuntimeConfig;
var init_checksum3 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/checksum.js"() {
    init_dist_es();
    knownAlgorithms = Object.values(AlgorithmId);
    getChecksumConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
      const checksumAlgorithms = [];
      for (const id in AlgorithmId) {
        const algorithmId = AlgorithmId[id];
        if (runtimeConfig[algorithmId] === void 0) {
          continue;
        }
        checksumAlgorithms.push({
          algorithmId: /* @__PURE__ */ __name(() => algorithmId, "algorithmId"),
          checksumConstructor: /* @__PURE__ */ __name(() => runtimeConfig[algorithmId], "checksumConstructor")
        });
      }
      for (const [id, ChecksumCtor] of Object.entries(runtimeConfig.checksumAlgorithms ?? {})) {
        checksumAlgorithms.push({
          algorithmId: /* @__PURE__ */ __name(() => id, "algorithmId"),
          checksumConstructor: /* @__PURE__ */ __name(() => ChecksumCtor, "checksumConstructor")
        });
      }
      return {
        addChecksumAlgorithm(algo) {
          runtimeConfig.checksumAlgorithms = runtimeConfig.checksumAlgorithms ?? {};
          const id = algo.algorithmId();
          const ctor = algo.checksumConstructor();
          if (knownAlgorithms.includes(id)) {
            runtimeConfig.checksumAlgorithms[id.toUpperCase()] = ctor;
          } else {
            runtimeConfig.checksumAlgorithms[id] = ctor;
          }
          checksumAlgorithms.push(algo);
        },
        checksumAlgorithms() {
          return checksumAlgorithms;
        }
      };
    }, "getChecksumConfiguration");
    resolveChecksumRuntimeConfig = /* @__PURE__ */ __name((clientConfig) => {
      const runtimeConfig = {};
      clientConfig.checksumAlgorithms().forEach((checksumAlgorithm) => {
        const id = checksumAlgorithm.algorithmId();
        if (knownAlgorithms.includes(id)) {
          runtimeConfig[id] = checksumAlgorithm.checksumConstructor();
        }
      });
      return runtimeConfig;
    }, "resolveChecksumRuntimeConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/retry.js
var getRetryConfiguration, resolveRetryRuntimeConfig;
var init_retry2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/retry.js"() {
    getRetryConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
      return {
        setRetryStrategy(retryStrategy) {
          runtimeConfig.retryStrategy = retryStrategy;
        },
        retryStrategy() {
          return runtimeConfig.retryStrategy;
        }
      };
    }, "getRetryConfiguration");
    resolveRetryRuntimeConfig = /* @__PURE__ */ __name((retryStrategyConfiguration) => {
      const runtimeConfig = {};
      runtimeConfig.retryStrategy = retryStrategyConfiguration.retryStrategy();
      return runtimeConfig;
    }, "resolveRetryRuntimeConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/defaultExtensionConfiguration.js
var getDefaultExtensionConfiguration, resolveDefaultRuntimeConfig;
var init_defaultExtensionConfiguration2 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/extensions/defaultExtensionConfiguration.js"() {
    init_checksum3();
    init_retry2();
    getDefaultExtensionConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
      return Object.assign(getChecksumConfiguration(runtimeConfig), getRetryConfiguration(runtimeConfig));
    }, "getDefaultExtensionConfiguration");
    resolveDefaultRuntimeConfig = /* @__PURE__ */ __name((config) => {
      return Object.assign(resolveChecksumRuntimeConfig(config), resolveRetryRuntimeConfig(config));
    }, "resolveDefaultRuntimeConfig");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/get-value-from-text-node.js
var getValueFromTextNode;
var init_get_value_from_text_node = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/get-value-from-text-node.js"() {
    getValueFromTextNode = /* @__PURE__ */ __name((obj) => {
      const textNodeName = "#text";
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key][textNodeName] !== void 0) {
          obj[key] = obj[key][textNodeName];
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          obj[key] = getValueFromTextNode(obj[key]);
        }
      }
      return obj;
    }, "getValueFromTextNode");
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/smithy-client/NoOpLogger.js
var NoOpLogger;
var init_NoOpLogger = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/smithy-client/NoOpLogger.js"() {
    NoOpLogger = class {
      static {
        __name(this, "NoOpLogger");
      }
      trace() {
      }
      debug() {
      }
      info() {
      }
      warn() {
      }
      error() {
      }
    };
  }
});

// node_modules/@smithy/core/dist-es/submodules/client/index.js
var init_client3 = __esm({
  "node_modules/@smithy/core/dist-es/submodules/client/index.js"() {
    init_getSmithyContext();
    init_normalizeProvider();
    init_invalidProvider();
    init_client2();
    init_command2();
    init_defaults_mode();
    init_exceptions();
    init_defaultExtensionConfiguration2();
    init_get_value_from_text_node();
    init_NoOpLogger();
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i2) {
      if (i2 <= index) {
        throw new Error("next() called multiple times");
      }
      index = i2;
      let res;
      let isError = false;
      let handler;
      if (middleware[i2]) {
        handler = middleware[i2][0][0];
        context.req.routeIndex = i2;
      } else {
        handler = i2 === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i2 + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/http-exception.js
var HTTPException = class extends Error {
  static {
    __name(this, "HTTPException");
  }
  res;
  status;
  /**
   * Creates an instance of `HTTPException`.
   * @param status - HTTP status code for the exception. Defaults to 500.
   * @param options - Additional options for the exception.
   */
  constructor(status = 500, options) {
    super(options?.message, { cause: options?.cause });
    this.res = options?.res;
    this.status = status;
  }
  /**
   * Returns the response object associated with the exception.
   * If a response object is not provided, a new response is created with the error message and status code.
   * @returns The response object.
   */
  getResponse() {
    if (this.res) {
      const newResponse = new Response(this.res.body, {
        status: this.status,
        headers: this.res.headers
      });
      return newResponse;
    }
    return new Response(this.message, {
      status: this.status
    });
  }
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i2 = groups.length - 1; i2 >= 0; i2--) {
    const [mark] = groups[i2];
    for (let j2 = paths.length - 1; j2 >= 0; j2--) {
      if (paths[j2].includes(mark)) {
        paths[j2] = paths[j2].replace(mark, groups[i2][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i2 = start;
  for (; i2 < url.length; i2++) {
    const charCode = url.charCodeAt(i2);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i2);
      const hashIndex = url.indexOf("#", i2);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i2);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v2, i2, a2) => a2.indexOf(v2) === i2);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c2) => c2({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k2, v2] of this.#res.headers.entries()) {
        if (k2 === "content-type") {
          continue;
        }
        if (k2 === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k2, v2);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k2, v2] of Object.entries(headers)) {
        if (typeof v2 === "string") {
          responseHeaders.set(k2, v2);
        } else {
          responseHeaders.delete(k2);
          for (const v22 of v2) {
            responseHeaders.append(k2, v22);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c2) => {
  return c2.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c2) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c2.newResponse(res.body, res);
  }
  console.error(err);
  return c2.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p2 of [path].flat()) {
        this.#path = p2;
        for (const m2 of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m2.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r2) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r2.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c2, next) => (await compose([], app2.errorHandler)(c2, () => r2.handler(c2, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r2.handler;
      }
      subApp.#addRoute(r2.method, r2.path, handler, r2.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c2) => {
      const options2 = optionHandler(c2);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c2) => {
      let executionContext = void 0;
      try {
        executionContext = c2.executionCtx;
      } catch {
      }
      return [c2.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c2, next) => {
      const res = await applicationHandler(replaceRequest(c2.req.raw), ...getOptions(c2));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r2 = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r2]);
    this.routes.push(r2);
  }
  #handleError(err, c2) {
    if (err instanceof Error) {
      return this.errorHandler(err, c2);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c2 = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c2, async () => {
          c2.res = await this.#notFoundHandler(c2);
        });
      } catch (err) {
        return this.#handleError(err, c2);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c2.finalized ? c2.res : this.#notFoundHandler(c2))
      ).catch((err) => this.#handleError(err, c2)) : res ?? this.#notFoundHandler(c2);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c2);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c2);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a2, b2) {
  if (a2.length === 1) {
    return b2.length === 1 ? a2 < b2 ? -1 : 1 : -1;
  }
  if (b2.length === 1) {
    return 1;
  }
  if (a2 === ONLY_WILDCARD_REG_EXP_STR || a2 === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b2 === ONLY_WILDCARD_REG_EXP_STR || b2 === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a2 === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b2 === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a2.length === b2.length ? a2 < b2 ? -1 : 1 : b2.length - a2.length;
}
__name(compareKey, "compareKey");
var Node2 = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k2) => k2 !== ONLY_WILDCARD_REG_EXP_STR && k2 !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k2) => k2.length > 1 && k2 !== ONLY_WILDCARD_REG_EXP_STR && k2 !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k2) => {
      const c2 = this.#children[k2];
      return (typeof c2.#varIndex === "number" ? `(${k2})@${c2.#varIndex}` : regExpMetaChars.has(k2) ? `\\${k2}` : k2) + c2.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node2();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i2 = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m2) => {
        const mark = `@\\${i2}`;
        groups[i2] = [mark, m2];
        i2++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i2 = groups.length - 1; i2 >= 0; i2--) {
      const [mark] = groups[i2];
      for (let j2 = tokens.length - 1; j2 >= 0; j2--) {
        if (tokens[j2].indexOf(mark) !== -1) {
          tokens[j2] = tokens[j2].replace(mark, groups[i2][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i2 = 0, j2 = -1, len = routesWithStaticPathFlag.length; i2 < len; i2++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i2];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h2]) => [h2, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j2++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j2, pathErrorCheckOnly);
    } catch (e2) {
      throw e2 === PATH_ERROR ? new UnsupportedPathError(path) : e2;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j2] = handlers.map(([h2, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h2, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i2 = 0, len = handlerData.length; i2 < len; i2++) {
    for (let j2 = 0, len2 = handlerData[i2].length; j2 < len2; j2++) {
      const map = handlerData[i2][j2]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k2 = 0, len3 = keys.length; k2 < len3; k2++) {
        map[keys[k2]] = paramReplacementMap[map[keys[k2]]];
      }
    }
  }
  const handlerMap = [];
  for (const i2 in indexReplacementMap) {
    handlerMap[i2] = handlerData[indexReplacementMap[i2]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k2 of Object.keys(middleware).sort((a2, b2) => b2.length - a2.length)) {
    if (buildWildcardRegExp(k2).test(path)) {
      return [...middleware[k2]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p2) => {
          handlerMap[method][p2] = [...handlerMap[METHOD_NAME_ALL][p2]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m2) => {
          middleware[m2][path] ||= findMiddleware(middleware[m2], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(middleware[m2]).forEach((p2) => {
            re.test(p2) && middleware[m2][p2].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(routes[m2]).forEach(
            (p2) => re.test(p2) && routes[m2][p2].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i2 = 0, len = paths.length; i2 < len; i2++) {
      const path2 = paths[i2];
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          routes[m2][path2] ||= [
            ...findMiddleware(middleware[m2], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m2][path2].push([handler, paramCount - len + i2 + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r2) => {
      const ownRoute = r2[method] ? Object.keys(r2[method]).map((path) => [path, r2[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r2[METHOD_NAME_ALL]).map((path) => [path, r2[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i2 = 0;
    let res;
    for (; i2 < len; i2++) {
      const router = routers[i2];
      try {
        for (let i22 = 0, len2 = routes.length; i22 < len2; i22++) {
          router.add(...routes[i22]);
        }
        res = router.match(method, path);
      } catch (e2) {
        if (e2 instanceof UnsupportedPathError) {
          continue;
        }
        throw e2;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i2 === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node3 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m2 = /* @__PURE__ */ Object.create(null);
      m2[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m2];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i2 = 0, len = parts.length; i2 < len; i2++) {
      const p2 = parts[i2];
      const nextP = parts[i2 + 1];
      const pattern = getPattern(p2, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p2;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v2, i2, a2) => a2.indexOf(v2) === i2),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i2 = 0, len = node.#methods.length; i2 < len; i2++) {
      const m2 = node.#methods[i2];
      const handlerSet = m2[method] || m2[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i22 = 0, len2 = handlerSet.possibleKeys.length; i22 < len2; i22++) {
            const key = handlerSet.possibleKeys[i22];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i2 = 0; i2 < len; i2++) {
      const part = parts[i2];
      const isLast = i2 === len - 1;
      const tempNodes = [];
      for (let j2 = 0, len2 = curNodes.length; j2 < len2; j2++) {
        const node = curNodes[j2];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k2 = 0, len3 = node.#patterns.length; k2 < len3; k2++) {
          const pattern = node.#patterns[k2];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p2 = 0; p2 < len; p2++) {
                partOffsets[p2] = offset;
                offset += parts[p2].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i2]);
            const m2 = matcher.exec(restPathString);
            if (m2) {
              params[name] = m2[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m2[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a2, b2) => {
        return a2.score - b2.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node3();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i2 = 0, len = results.length; i2 < len; i2++) {
        this.#node.insert(method, results[i2], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c2, next) {
    function set(key, value) {
      c2.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c2.req.header("origin") || "", c2);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c2.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c2.req.header("origin") || "", c2);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c2.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c2.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c2.res.headers.delete("Content-Length");
      c2.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c2.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c2.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/db/client.js
function getDbClient(env) {
  const db = env.DB;
  return {
    execute: /* @__PURE__ */ __name(async (query) => {
      let sql, args;
      if (typeof query === "string") {
        sql = query;
        args = [];
      } else {
        sql = query.sql;
        args = query.args || [];
      }
      let stmt = db.prepare(sql);
      if (args && args.length > 0) {
        stmt = stmt.bind(...args);
      }
      const res = await stmt.all();
      return { rows: res.results };
    }, "execute")
  };
}
__name(getDbClient, "getDbClient");

// src/api/session.js
async function handleSessionRequest(c2) {
  const token = c2.req.param("token");
  if (!token) {
    return c2.json({ error: "Missing token" }, 400);
  }
  const db = getDbClient(c2.env);
  const tokenRes = await db.execute({
    sql: `SELECT s.status, s.expires_at, l.id as lead_id, l.phone_number 
          FROM secure_tokens s
          JOIN leads l ON s.lead_id = l.id
          WHERE s.token = ?`,
    args: [token]
  });
  if (tokenRes.rows.length === 0) {
    return c2.json({ error: "Invalid token" }, 404);
  }
  const session = tokenRes.rows[0];
  const ip = c2.req.header("CF-Connecting-IP") || c2.req.header("X-Forwarded-For") || "unknown";
  const ua = c2.req.header("User-Agent") || "unknown";
  const currentFingerprint = btoa(ip + ua).slice(0, 32);
  if (!session.fingerprint_hash) {
    await db.execute({
      sql: "UPDATE secure_tokens SET fingerprint_hash = ? WHERE token = ?",
      args: [currentFingerprint, token]
    });
  } else if (session.fingerprint_hash !== currentFingerprint) {
    await db.execute({
      sql: "UPDATE secure_tokens SET status = 'locked' WHERE token = ?",
      args: [token]
    });
    return c2.json({ error: "Security Lockout: Link opened from a different device or network." }, 403);
  }
  if (session.status !== "active" || new Date(session.expires_at) < /* @__PURE__ */ new Date()) {
    return c2.json({ error: "Session expired or locked", status: session.status }, 403);
  }
  const docsRes = await db.execute({
    sql: `SELECT id, document_type, status 
          FROM document_requests 
          WHERE lead_id = ?`,
    args: [session.lead_id]
  });
  const documents = docsRes.rows.map((r2) => ({
    id: r2.id,
    type: r2.document_type,
    status: r2.status
    // pending, received, failed
  }));
  return c2.json({
    status: "active",
    phoneMasked: session.phone_number.slice(0, 3) + "****" + session.phone_number.slice(-4),
    documents
  });
}
__name(handleSessionRequest, "handleSessionRequest");

// node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js
function setCredentialFeature(credentials, feature, value) {
  if (!credentials.$source) {
    credentials.$source = {};
  }
  credentials.$source[feature] = value;
  return credentials;
}
__name(setCredentialFeature, "setCredentialFeature");

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/isStreamingPayload/isStreamingPayload.browser.js
var isStreamingPayload = /* @__PURE__ */ __name((request) => request?.body instanceof ReadableStream, "isStreamingPayload");

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/retryMiddleware.js
init_client3();
init_protocols();
init_index_browser2();

// node_modules/@smithy/core/dist-es/submodules/retry/service-error-classification/constants.js
var THROTTLING_ERROR_CODES = [
  "BandwidthLimitExceeded",
  "EC2ThrottledException",
  "LimitExceededException",
  "PriorRequestNotComplete",
  "ProvisionedThroughputExceededException",
  "RequestLimitExceeded",
  "RequestThrottled",
  "RequestThrottledException",
  "SlowDown",
  "ThrottledException",
  "Throttling",
  "ThrottlingException",
  "TooManyRequestsException",
  "TransactionInProgressException"
];
var TRANSIENT_ERROR_CODES = ["TimeoutError", "RequestTimeout", "RequestTimeoutException"];
var TRANSIENT_ERROR_STATUS_CODES = [500, 502, 503, 504];
var NODEJS_TIMEOUT_ERROR_CODES = ["ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT"];
var NODEJS_NETWORK_ERROR_CODES = ["EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND"];

// node_modules/@smithy/core/dist-es/submodules/retry/service-error-classification/service-error-classification.js
var isRetryableByTrait = /* @__PURE__ */ __name((error) => error?.$retryable !== void 0, "isRetryableByTrait");
var isClockSkewCorrectedError = /* @__PURE__ */ __name((error) => error.$metadata?.clockSkewCorrected, "isClockSkewCorrectedError");
var isBrowserNetworkError = /* @__PURE__ */ __name((error) => {
  const errorMessages = /* @__PURE__ */ new Set([
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "The Internet connection appears to be offline",
    "Load failed",
    "Network request failed"
  ]);
  const isValid = error && error instanceof TypeError;
  if (!isValid) {
    return false;
  }
  return errorMessages.has(error.message);
}, "isBrowserNetworkError");
var isThrottlingError = /* @__PURE__ */ __name((error) => error.$metadata?.httpStatusCode === 429 || THROTTLING_ERROR_CODES.includes(error.name) || error.$retryable?.throttling == true, "isThrottlingError");
var isTransientError = /* @__PURE__ */ __name((error, depth = 0) => isRetryableByTrait(error) || isClockSkewCorrectedError(error) || error.name === "InvalidSignatureException" && error.message?.includes("Signature expired") || TRANSIENT_ERROR_CODES.includes(error.name) || NODEJS_TIMEOUT_ERROR_CODES.includes(error?.code || "") || NODEJS_NETWORK_ERROR_CODES.includes(error?.code || "") || TRANSIENT_ERROR_STATUS_CODES.includes(error.$metadata?.httpStatusCode || 0) || isBrowserNetworkError(error) || isNodeJsHttp2TransientError(error) || error.cause !== void 0 && depth <= 10 && isTransientError(error.cause, depth + 1), "isTransientError");
var isServerError = /* @__PURE__ */ __name((error) => {
  if (error.$metadata?.httpStatusCode !== void 0) {
    const statusCode = error.$metadata.httpStatusCode;
    if (500 <= statusCode && statusCode <= 599 && !isTransientError(error)) {
      return true;
    }
    return false;
  }
  return false;
}, "isServerError");
function isNodeJsHttp2TransientError(error) {
  return error.code === "ERR_HTTP2_STREAM_ERROR" && error.message.includes("NGHTTP2_REFUSED_STREAM");
}
__name(isNodeJsHttp2TransientError, "isNodeJsHttp2TransientError");

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/constants.js
var MAXIMUM_RETRY_DELAY = 20 * 1e3;
var INITIAL_RETRY_TOKENS = 500;
var NO_RETRY_INCREMENT = 1;
var INVOCATION_ID_HEADER = "amz-sdk-invocation-id";
var REQUEST_HEADER = "amz-sdk-request";

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/parseRetryAfterHeader.js
init_protocols();
init_index_browser2();
function parseRetryAfterHeader(response, logger2) {
  if (!HttpResponse.isInstance(response)) {
    return;
  }
  for (const header of Object.keys(response.headers)) {
    const h2 = header.toLowerCase();
    if (h2 === "retry-after") {
      const retryAfter = response.headers[header];
      let retryAfterSeconds = NaN;
      if (retryAfter.endsWith("GMT")) {
        try {
          const date2 = parseRfc7231DateTime(retryAfter);
          retryAfterSeconds = (date2.getTime() - Date.now()) / 1e3;
        } catch (e2) {
          logger2?.trace?.("Failed to parse retry-after header");
          logger2?.trace?.(e2);
        }
      } else if (retryAfter.match(/ GMT, ((\d+)|(\d+\.\d+))$/)) {
        retryAfterSeconds = Number(retryAfter.match(/ GMT, ([\d.]+)$/)?.[1]);
      } else if (retryAfter.match(/^((\d+)|(\d+\.\d+))$/)) {
        retryAfterSeconds = Number(retryAfter);
      } else if (Date.parse(retryAfter) >= Date.now()) {
        retryAfterSeconds = (Date.parse(retryAfter) - Date.now()) / 1e3;
      }
      if (isNaN(retryAfterSeconds)) {
        return;
      }
      return new Date(Date.now() + retryAfterSeconds * 1e3);
    } else if (h2 === "x-amz-retry-after") {
      const v2 = response.headers[header];
      const backoffMilliseconds = Number(v2);
      if (isNaN(backoffMilliseconds)) {
        logger2?.trace?.(`Failed to parse x-amz-retry-after=${v2}`);
        return;
      }
      return new Date(Date.now() + backoffMilliseconds);
    }
  }
}
__name(parseRetryAfterHeader, "parseRetryAfterHeader");

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/util.js
var asSdkError = /* @__PURE__ */ __name((error) => {
  if (error instanceof Error)
    return error;
  if (error instanceof Object)
    return Object.assign(new Error(), error);
  if (typeof error === "string")
    return new Error(error);
  return new Error(`AWS SDK error wrapper for ${error}`);
}, "asSdkError");

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/retryMiddleware.js
function bindRetryMiddleware(isStreamingPayload2) {
  return (options) => (next, context) => async (args) => {
    let retryStrategy = await options.retryStrategy();
    const maxAttempts = await options.maxAttempts();
    if (isRetryStrategyV2(retryStrategy)) {
      retryStrategy = retryStrategy;
      let retryToken = await retryStrategy.acquireInitialRetryToken((context["partition_id"] ?? "") + (context.__retryLongPoll ? ":longpoll" : ""));
      let lastError = new Error();
      let attempts = 0;
      let totalRetryDelay = 0;
      const { request } = args;
      const isRequest = HttpRequest.isInstance(request);
      if (isRequest) {
        request.headers[INVOCATION_ID_HEADER] = v4();
      }
      while (true) {
        try {
          if (isRequest) {
            request.headers[REQUEST_HEADER] = `attempt=${attempts + 1}; max=${maxAttempts}`;
          }
          const { response, output } = await next(args);
          retryStrategy.recordSuccess(retryToken);
          output.$metadata.attempts = attempts + 1;
          output.$metadata.totalRetryDelay = totalRetryDelay;
          return { response, output };
        } catch (e2) {
          const retryErrorInfo = getRetryErrorInfo(e2, options.logger);
          lastError = asSdkError(e2);
          if (isRequest && isStreamingPayload2(request)) {
            (context.logger instanceof NoOpLogger ? console : context.logger)?.warn("An error was encountered in a non-retryable streaming request.");
            throw lastError;
          }
          try {
            retryToken = await retryStrategy.refreshRetryTokenForRetry(retryToken, retryErrorInfo);
          } catch (refreshError) {
            if (typeof refreshError.$backoff === "number") {
              await cooldown(refreshError.$backoff);
            }
            if (!lastError.$metadata) {
              lastError.$metadata = {};
            }
            lastError.$metadata.attempts = attempts + 1;
            lastError.$metadata.totalRetryDelay = totalRetryDelay;
            throw lastError;
          }
          attempts = retryToken.getRetryCount();
          const delay = retryToken.getRetryDelay();
          totalRetryDelay += delay;
          await cooldown(delay);
        }
      }
    } else {
      retryStrategy = retryStrategy;
      if (retryStrategy?.mode) {
        context.userAgent = [...context.userAgent || [], ["cfg/retry-mode", retryStrategy.mode]];
      }
      return retryStrategy.retry(next, args);
    }
  };
}
__name(bindRetryMiddleware, "bindRetryMiddleware");
var cooldown = /* @__PURE__ */ __name((ms) => new Promise((resolve) => setTimeout(resolve, ms)), "cooldown");
var isRetryStrategyV2 = /* @__PURE__ */ __name((retryStrategy) => typeof retryStrategy.acquireInitialRetryToken !== "undefined" && typeof retryStrategy.refreshRetryTokenForRetry !== "undefined" && typeof retryStrategy.recordSuccess !== "undefined", "isRetryStrategyV2");
var getRetryErrorInfo = /* @__PURE__ */ __name((error, logger2) => {
  const errorInfo = {
    error,
    errorType: getRetryErrorType(error)
  };
  const retryAfterHint = parseRetryAfterHeader(error.$response, logger2);
  if (retryAfterHint) {
    errorInfo.retryAfterHint = retryAfterHint;
  }
  return errorInfo;
}, "getRetryErrorInfo");
var getRetryErrorType = /* @__PURE__ */ __name((error) => {
  if (isThrottlingError(error))
    return "THROTTLING";
  if (isTransientError(error))
    return "TRANSIENT";
  if (isServerError(error))
    return "SERVER_ERROR";
  return "CLIENT_ERROR";
}, "getRetryErrorType");
var retryMiddlewareOptions = {
  name: "retryMiddleware",
  tags: ["RETRY"],
  step: "finalizeRequest",
  priority: "high",
  override: true
};
function bindGetRetryPlugin(isStreamingPayload2) {
  const retryMiddleware2 = bindRetryMiddleware(isStreamingPayload2);
  return (options) => ({
    applyToStack: /* @__PURE__ */ __name((clientStack) => {
      clientStack.add(retryMiddleware2(options), retryMiddlewareOptions);
    }, "applyToStack")
  });
}
__name(bindGetRetryPlugin, "bindGetRetryPlugin");

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/DefaultRateLimiter.js
var DefaultRateLimiter = class _DefaultRateLimiter {
  static {
    __name(this, "DefaultRateLimiter");
  }
  static setTimeoutFn = setTimeout;
  beta;
  minCapacity;
  minFillRate;
  scaleConstant;
  smooth;
  enabled = false;
  availableTokens = 0;
  lastMaxRate = 0;
  measuredTxRate = 0;
  requestCount = 0;
  fillRate;
  lastThrottleTime;
  lastTimestamp = 0;
  lastTxRateBucket;
  maxCapacity;
  timeWindow = 0;
  constructor(options) {
    this.beta = options?.beta ?? 0.7;
    this.minCapacity = options?.minCapacity ?? 1;
    this.minFillRate = options?.minFillRate ?? 0.5;
    this.scaleConstant = options?.scaleConstant ?? 0.4;
    this.smooth = options?.smooth ?? 0.8;
    this.lastThrottleTime = this.getCurrentTimeInSeconds();
    this.lastTxRateBucket = Math.floor(this.getCurrentTimeInSeconds());
    this.fillRate = this.minFillRate;
    this.maxCapacity = this.minCapacity;
  }
  async getSendToken() {
    return this.acquireTokenBucket(1);
  }
  updateClientSendingRate(response) {
    let calculatedRate;
    this.updateMeasuredRate();
    const retryErrorInfo = response;
    const isThrottling = retryErrorInfo?.errorType === "THROTTLING" || isThrottlingError(retryErrorInfo?.error ?? response);
    if (isThrottling) {
      const rateToUse = !this.enabled ? this.measuredTxRate : Math.min(this.measuredTxRate, this.fillRate);
      this.lastMaxRate = rateToUse;
      this.calculateTimeWindow();
      this.lastThrottleTime = this.getCurrentTimeInSeconds();
      calculatedRate = this.cubicThrottle(rateToUse);
      this.enableTokenBucket();
    } else {
      this.calculateTimeWindow();
      calculatedRate = this.cubicSuccess(this.getCurrentTimeInSeconds());
    }
    const newRate = Math.min(calculatedRate, 2 * this.measuredTxRate);
    this.updateTokenBucketRate(newRate);
  }
  getCurrentTimeInSeconds() {
    return Date.now() / 1e3;
  }
  async acquireTokenBucket(amount) {
    if (!this.enabled) {
      return;
    }
    this.refillTokenBucket();
    while (amount > this.availableTokens) {
      const delay = (amount - this.availableTokens) / this.fillRate * 1e3;
      await new Promise((resolve) => _DefaultRateLimiter.setTimeoutFn(resolve, delay));
      this.refillTokenBucket();
    }
    this.availableTokens = this.availableTokens - amount;
  }
  refillTokenBucket() {
    const timestamp = this.getCurrentTimeInSeconds();
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      return;
    }
    const fillAmount = (timestamp - this.lastTimestamp) * this.fillRate;
    this.availableTokens = Math.min(this.maxCapacity, this.availableTokens + fillAmount);
    this.lastTimestamp = timestamp;
  }
  calculateTimeWindow() {
    this.timeWindow = this.getPrecise(Math.pow(this.lastMaxRate * (1 - this.beta) / this.scaleConstant, 1 / 3));
  }
  cubicThrottle(rateToUse) {
    return this.getPrecise(rateToUse * this.beta);
  }
  cubicSuccess(timestamp) {
    return this.getPrecise(this.scaleConstant * Math.pow(timestamp - this.lastThrottleTime - this.timeWindow, 3) + this.lastMaxRate);
  }
  enableTokenBucket() {
    this.enabled = true;
  }
  updateTokenBucketRate(newRate) {
    this.refillTokenBucket();
    this.fillRate = Math.max(newRate, this.minFillRate);
    this.maxCapacity = Math.max(newRate, this.minCapacity);
    this.availableTokens = Math.min(this.availableTokens, this.maxCapacity);
  }
  updateMeasuredRate() {
    const t8 = this.getCurrentTimeInSeconds();
    const timeBucket = Math.floor(t8 * 2) / 2;
    this.requestCount++;
    if (timeBucket > this.lastTxRateBucket) {
      const currentRate = this.requestCount / (timeBucket - this.lastTxRateBucket);
      this.measuredTxRate = this.getPrecise(currentRate * this.smooth + this.measuredTxRate * (1 - this.smooth));
      this.requestCount = 0;
      this.lastTxRateBucket = timeBucket;
    }
  }
  getPrecise(num) {
    return parseFloat(num.toFixed(8));
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/retries-2026-config.js
var Retry = class _Retry {
  static {
    __name(this, "Retry");
  }
  static v2026 = typeof process !== "undefined" && process.env?.SMITHY_NEW_RETRIES_2026 === "true";
  static delay() {
    return _Retry.v2026 ? 50 : 100;
  }
  static throttlingDelay() {
    return _Retry.v2026 ? 1e3 : 500;
  }
  static cost() {
    return _Retry.v2026 ? 14 : 5;
  }
  static throttlingCost() {
    return _Retry.v2026 ? 5 : 10;
  }
  static modifiedCostType() {
    return _Retry.v2026 ? "THROTTLING" : "TRANSIENT";
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/DefaultRetryBackoffStrategy.js
var DefaultRetryBackoffStrategy = class {
  static {
    __name(this, "DefaultRetryBackoffStrategy");
  }
  x = Retry.delay();
  computeNextBackoffDelay(i2) {
    const b2 = Math.random();
    const r2 = 2;
    const t_i = b2 * Math.min(this.x * r2 ** i2, MAXIMUM_RETRY_DELAY);
    return Math.floor(t_i);
  }
  setDelayBase(delay) {
    this.x = delay;
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/DefaultRetryToken.js
var DefaultRetryToken = class {
  static {
    __name(this, "DefaultRetryToken");
  }
  delay;
  count;
  cost;
  longPoll;
  constructor(delay, count, cost, longPoll) {
    this.delay = delay;
    this.count = count;
    this.cost = cost;
    this.longPoll = longPoll;
  }
  getRetryCount() {
    return this.count;
  }
  getRetryDelay() {
    return Math.min(MAXIMUM_RETRY_DELAY, this.delay);
  }
  getRetryCost() {
    return this.cost;
  }
  isLongPoll() {
    return this.longPoll;
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/config.js
var RETRY_MODES;
(function(RETRY_MODES2) {
  RETRY_MODES2["STANDARD"] = "standard";
  RETRY_MODES2["ADAPTIVE"] = "adaptive";
})(RETRY_MODES || (RETRY_MODES = {}));
var DEFAULT_MAX_ATTEMPTS = 3;
var DEFAULT_RETRY_MODE = RETRY_MODES.STANDARD;

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/StandardRetryStrategy.js
var refusal = {
  incompatible: 1,
  attempts: 2,
  capacity: 3
};
var StandardRetryStrategy = class {
  static {
    __name(this, "StandardRetryStrategy");
  }
  mode = RETRY_MODES.STANDARD;
  capacity = INITIAL_RETRY_TOKENS;
  retryBackoffStrategy;
  maxAttemptsProvider;
  baseDelay;
  constructor(arg1) {
    if (typeof arg1 === "number") {
      this.maxAttemptsProvider = async () => arg1;
    } else if (typeof arg1 === "function") {
      this.maxAttemptsProvider = arg1;
    } else if (arg1 && typeof arg1 === "object") {
      this.maxAttemptsProvider = async () => arg1.maxAttempts;
      this.baseDelay = arg1.baseDelay;
      this.retryBackoffStrategy = arg1.backoff;
    }
    this.maxAttemptsProvider ??= async () => DEFAULT_MAX_ATTEMPTS;
    this.baseDelay ??= Retry.delay();
    this.retryBackoffStrategy ??= new DefaultRetryBackoffStrategy();
  }
  async acquireInitialRetryToken(retryTokenScope) {
    return new DefaultRetryToken(Retry.delay(), 0, void 0, Retry.v2026 && retryTokenScope.includes(":longpoll"));
  }
  async refreshRetryTokenForRetry(token, errorInfo) {
    const maxAttempts = await this.getMaxAttempts();
    const retryCode = this.retryCode(token, errorInfo, maxAttempts);
    const shouldRetry = retryCode === 0;
    const isLongPoll = token.isLongPoll?.();
    if (shouldRetry || isLongPoll) {
      const errorType = errorInfo.errorType;
      this.retryBackoffStrategy.setDelayBase(errorType === "THROTTLING" ? Retry.throttlingDelay() : this.baseDelay);
      const delayFromErrorType = this.retryBackoffStrategy.computeNextBackoffDelay(token.getRetryCount());
      let retryDelay = delayFromErrorType;
      if (errorInfo.retryAfterHint instanceof Date) {
        retryDelay = Math.max(delayFromErrorType, Math.min(errorInfo.retryAfterHint.getTime() - Date.now(), delayFromErrorType + 5e3));
      }
      if (!shouldRetry) {
        throw Object.assign(new Error("No retry token available"), {
          $backoff: Retry.v2026 && retryCode === refusal.capacity && isLongPoll ? retryDelay : 0
        });
      } else {
        const capacityCost = this.getCapacityCost(errorType);
        this.capacity -= capacityCost;
        return new DefaultRetryToken(retryDelay, token.getRetryCount() + 1, capacityCost, token.isLongPoll?.() ?? false);
      }
    }
    throw new Error("No retry token available");
  }
  recordSuccess(token) {
    this.capacity = Math.min(INITIAL_RETRY_TOKENS, this.capacity + (token.getRetryCost() ?? NO_RETRY_INCREMENT));
  }
  getCapacity() {
    return this.capacity;
  }
  async maxAttempts() {
    return this.maxAttemptsProvider();
  }
  async getMaxAttempts() {
    try {
      return await this.maxAttemptsProvider();
    } catch (error) {
      console.warn(`Max attempts provider could not resolve. Using default of ${DEFAULT_MAX_ATTEMPTS}`);
      return DEFAULT_MAX_ATTEMPTS;
    }
  }
  retryCode(tokenToRenew, errorInfo, maxAttempts) {
    const attempts = tokenToRenew.getRetryCount() + 1;
    const retryableStatus = this.isRetryableError(errorInfo.errorType) ? 0 : refusal.incompatible;
    const attemptStatus = attempts < maxAttempts ? 0 : refusal.attempts;
    const capacityStatus = this.capacity >= this.getCapacityCost(errorInfo.errorType) ? 0 : refusal.capacity;
    return retryableStatus || attemptStatus || capacityStatus;
  }
  getCapacityCost(errorType) {
    return errorType === Retry.modifiedCostType() ? Retry.throttlingCost() : Retry.cost();
  }
  isRetryableError(errorType) {
    return errorType === "THROTTLING" || errorType === "TRANSIENT";
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/util-retry/AdaptiveRetryStrategy.js
var AdaptiveRetryStrategy = class {
  static {
    __name(this, "AdaptiveRetryStrategy");
  }
  mode = RETRY_MODES.ADAPTIVE;
  rateLimiter;
  standardRetryStrategy;
  constructor(maxAttemptsProvider, options) {
    const { rateLimiter } = options ?? {};
    this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();
    this.standardRetryStrategy = options ? new StandardRetryStrategy({
      maxAttempts: typeof maxAttemptsProvider === "number" ? maxAttemptsProvider : 3,
      ...options
    }) : new StandardRetryStrategy(maxAttemptsProvider);
  }
  async acquireInitialRetryToken(retryTokenScope) {
    const token = await this.standardRetryStrategy.acquireInitialRetryToken(retryTokenScope);
    await this.rateLimiter.getSendToken();
    return token;
  }
  async refreshRetryTokenForRetry(tokenToRenew, errorInfo) {
    this.rateLimiter.updateClientSendingRate(errorInfo);
    const token = await this.standardRetryStrategy.refreshRetryTokenForRetry(tokenToRenew, errorInfo);
    await this.rateLimiter.getSendToken();
    return token;
  }
  recordSuccess(token) {
    this.rateLimiter.updateClientSendingRate({});
    this.standardRetryStrategy.recordSuccess(token);
  }
  async maxAttemptsProvider() {
    return this.standardRetryStrategy.maxAttempts();
  }
};

// node_modules/@smithy/core/dist-es/submodules/retry/middleware-retry/configurations.js
init_client3();
var resolveRetryConfig = /* @__PURE__ */ __name((input) => {
  const { retryStrategy, retryMode } = input;
  const maxAttempts = normalizeProvider(input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  let controller = retryStrategy ? Promise.resolve(retryStrategy) : void 0;
  const getDefault = /* @__PURE__ */ __name(async () => await normalizeProvider(retryMode)() === RETRY_MODES.ADAPTIVE ? new AdaptiveRetryStrategy(maxAttempts) : new StandardRetryStrategy(maxAttempts), "getDefault");
  return Object.assign(input, {
    maxAttempts,
    retryStrategy: /* @__PURE__ */ __name(() => controller ??= getDefault(), "retryStrategy")
  });
}, "resolveRetryConfig");

// node_modules/@smithy/core/dist-es/submodules/retry/index.browser.js
var retryMiddleware = bindRetryMiddleware(isStreamingPayload);
var getRetryPlugin = bindGetRetryPlugin(isStreamingPayload);

// node_modules/@aws-sdk/core/dist-es/submodules/client/setFeature.js
Retry.v2026 ||= typeof process === "object" && process.env?.AWS_NEW_RETRIES_2026 === "true";
function setFeature2(context, feature, value) {
  if (!context.__aws_sdk_context) {
    context.__aws_sdk_context = {
      features: {}
    };
  } else if (!context.__aws_sdk_context.features) {
    context.__aws_sdk_context.features = {};
  }
  context.__aws_sdk_context.features[feature] = value;
}
__name(setFeature2, "setFeature");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-host-header/hostHeaderMiddleware.js
init_protocols();
function resolveHostHeaderConfig(input) {
  return input;
}
__name(resolveHostHeaderConfig, "resolveHostHeaderConfig");
var hostHeaderMiddleware = /* @__PURE__ */ __name((options) => (next) => async (args) => {
  if (!HttpRequest.isInstance(args.request))
    return next(args);
  const { request } = args;
  const { handlerProtocol = "" } = options.requestHandler.metadata || {};
  if (handlerProtocol.indexOf("h2") >= 0 && !request.headers[":authority"]) {
    delete request.headers["host"];
    request.headers[":authority"] = request.hostname + (request.port ? ":" + request.port : "");
  } else if (!request.headers["host"]) {
    let host = request.hostname;
    if (request.port != null)
      host += `:${request.port}`;
    request.headers["host"] = host;
  }
  return next(args);
}, "hostHeaderMiddleware");
var hostHeaderMiddlewareOptions = {
  name: "hostHeaderMiddleware",
  step: "build",
  priority: "low",
  tags: ["HOST"],
  override: true
};
var getHostHeaderPlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(hostHeaderMiddleware(options), hostHeaderMiddlewareOptions);
  }, "applyToStack")
}), "getHostHeaderPlugin");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-logger/loggerMiddleware.js
var loggerMiddleware = /* @__PURE__ */ __name(() => (next, context) => async (args) => {
  try {
    const response = await next(args);
    const { clientName, commandName, logger: logger2, dynamoDbDocumentClientOptions = {} } = context;
    const { overrideInputFilterSensitiveLog, overrideOutputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
    const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
    const outputFilterSensitiveLog = overrideOutputFilterSensitiveLog ?? context.outputFilterSensitiveLog;
    const { $metadata, ...outputWithoutMetadata } = response.output;
    logger2?.info?.({
      clientName,
      commandName,
      input: inputFilterSensitiveLog(args.input),
      output: outputFilterSensitiveLog(outputWithoutMetadata),
      metadata: $metadata
    });
    return response;
  } catch (error) {
    const { clientName, commandName, logger: logger2, dynamoDbDocumentClientOptions = {} } = context;
    const { overrideInputFilterSensitiveLog } = dynamoDbDocumentClientOptions;
    const inputFilterSensitiveLog = overrideInputFilterSensitiveLog ?? context.inputFilterSensitiveLog;
    logger2?.error?.({
      clientName,
      commandName,
      input: inputFilterSensitiveLog(args.input),
      error,
      metadata: error.$metadata
    });
    throw error;
  }
}, "loggerMiddleware");
var loggerMiddlewareOptions = {
  name: "loggerMiddleware",
  tags: ["LOGGER"],
  step: "initialize",
  override: true
};
var getLoggerPlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(loggerMiddleware(), loggerMiddlewareOptions);
  }, "applyToStack")
}), "getLoggerPlugin");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-recursion-detection/getRecursionDetectionPlugin.browser.js
var getRecursionDetectionPlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
  }, "applyToStack")
}), "getRecursionDetectionPlugin");

// node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/httpAuthSchemeMiddleware.js
init_client3();

// node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/resolveAuthOptions.js
var resolveAuthOptions = /* @__PURE__ */ __name((candidateAuthOptions, authSchemePreference) => {
  if (!authSchemePreference || authSchemePreference.length === 0) {
    return candidateAuthOptions;
  }
  const preferredAuthOptions = [];
  for (const preferredSchemeName of authSchemePreference) {
    for (const candidateAuthOption of candidateAuthOptions) {
      const candidateAuthSchemeName = candidateAuthOption.schemeId.split("#")[1];
      if (candidateAuthSchemeName === preferredSchemeName) {
        preferredAuthOptions.push(candidateAuthOption);
      }
    }
  }
  for (const candidateAuthOption of candidateAuthOptions) {
    if (!preferredAuthOptions.find(({ schemeId }) => schemeId === candidateAuthOption.schemeId)) {
      preferredAuthOptions.push(candidateAuthOption);
    }
  }
  return preferredAuthOptions;
}, "resolveAuthOptions");

// node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/httpAuthSchemeMiddleware.js
function convertHttpAuthSchemesToMap(httpAuthSchemes) {
  const map = /* @__PURE__ */ new Map();
  for (const scheme of httpAuthSchemes) {
    map.set(scheme.schemeId, scheme);
  }
  return map;
}
__name(convertHttpAuthSchemesToMap, "convertHttpAuthSchemesToMap");
var httpAuthSchemeMiddleware = /* @__PURE__ */ __name((config, mwOptions) => (next, context) => async (args) => {
  const options = config.httpAuthSchemeProvider(await mwOptions.httpAuthSchemeParametersProvider(config, context, args.input));
  const authSchemePreference = config.authSchemePreference ? await config.authSchemePreference() : [];
  const resolvedOptions = resolveAuthOptions(options, authSchemePreference);
  const authSchemes = convertHttpAuthSchemesToMap(config.httpAuthSchemes);
  const smithyContext = getSmithyContext(context);
  const failureReasons = [];
  for (const option of resolvedOptions) {
    const scheme = authSchemes.get(option.schemeId);
    if (!scheme) {
      failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` was not enabled for this service.`);
      continue;
    }
    const identityProvider = scheme.identityProvider(await mwOptions.identityProviderConfigProvider(config));
    if (!identityProvider) {
      failureReasons.push(`HttpAuthScheme \`${option.schemeId}\` did not have an IdentityProvider configured.`);
      continue;
    }
    const { identityProperties = {}, signingProperties = {} } = option.propertiesExtractor?.(config, context) || {};
    option.identityProperties = Object.assign(option.identityProperties || {}, identityProperties);
    option.signingProperties = Object.assign(option.signingProperties || {}, signingProperties);
    smithyContext.selectedHttpAuthScheme = {
      httpAuthOption: option,
      identity: await identityProvider(option.identityProperties),
      signer: scheme.signer
    };
    break;
  }
  if (!smithyContext.selectedHttpAuthScheme) {
    throw new Error(failureReasons.join("\n"));
  }
  return next(args);
}, "httpAuthSchemeMiddleware");

// node_modules/@smithy/core/dist-es/middleware-http-auth-scheme/getHttpAuthSchemeEndpointRuleSetPlugin.js
var httpAuthSchemeEndpointRuleSetMiddlewareOptions = {
  step: "serialize",
  tags: ["HTTP_AUTH_SCHEME"],
  name: "httpAuthSchemeMiddleware",
  override: true,
  relation: "before",
  toMiddleware: "endpointV2Middleware"
};
var getHttpAuthSchemeEndpointRuleSetPlugin = /* @__PURE__ */ __name((config, { httpAuthSchemeParametersProvider, identityProviderConfigProvider }) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.addRelativeTo(httpAuthSchemeMiddleware(config, {
      httpAuthSchemeParametersProvider,
      identityProviderConfigProvider
    }), httpAuthSchemeEndpointRuleSetMiddlewareOptions);
  }, "applyToStack")
}), "getHttpAuthSchemeEndpointRuleSetPlugin");

// node_modules/@smithy/core/dist-es/middleware-http-signing/httpSigningMiddleware.js
init_client3();
init_protocols();
var defaultErrorHandler = /* @__PURE__ */ __name((signingProperties) => (error) => {
  throw error;
}, "defaultErrorHandler");
var defaultSuccessHandler = /* @__PURE__ */ __name((httpResponse, signingProperties) => {
}, "defaultSuccessHandler");
var httpSigningMiddleware = /* @__PURE__ */ __name((config) => (next, context) => async (args) => {
  if (!HttpRequest.isInstance(args.request)) {
    return next(args);
  }
  const smithyContext = getSmithyContext(context);
  const scheme = smithyContext.selectedHttpAuthScheme;
  if (!scheme) {
    throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
  }
  const { httpAuthOption: { signingProperties = {} }, identity, signer } = scheme;
  const output = await next({
    ...args,
    request: await signer.sign(args.request, identity, signingProperties)
  }).catch((signer.errorHandler || defaultErrorHandler)(signingProperties));
  (signer.successHandler || defaultSuccessHandler)(output.response, signingProperties);
  return output;
}, "httpSigningMiddleware");

// node_modules/@smithy/core/dist-es/middleware-http-signing/getHttpSigningMiddleware.js
var httpSigningMiddlewareOptions = {
  step: "finalizeRequest",
  tags: ["HTTP_SIGNING"],
  name: "httpSigningMiddleware",
  aliases: ["apiKeyMiddleware", "tokenMiddleware", "awsAuthMiddleware"],
  override: true,
  relation: "after",
  toMiddleware: "retryMiddleware"
};
var getHttpSigningPlugin = /* @__PURE__ */ __name((config) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.addRelativeTo(httpSigningMiddleware(config), httpSigningMiddlewareOptions);
  }, "applyToStack")
}), "getHttpSigningPlugin");

// node_modules/@smithy/core/dist-es/normalizeProvider.js
var normalizeProvider2 = /* @__PURE__ */ __name((input) => {
  if (typeof input === "function")
    return input;
  const promisified = Promise.resolve(input);
  return () => promisified;
}, "normalizeProvider");

// node_modules/@smithy/core/dist-es/util-identity-and-auth/DefaultIdentityProviderConfig.js
var DefaultIdentityProviderConfig = class {
  static {
    __name(this, "DefaultIdentityProviderConfig");
  }
  authSchemes = /* @__PURE__ */ new Map();
  constructor(config) {
    for (const key in config) {
      const value = config[key];
      if (value !== void 0) {
        this.authSchemes.set(key, value);
      }
    }
  }
  getIdentityProvider(schemeId) {
    return this.authSchemes.get(schemeId);
  }
};

// node_modules/@smithy/core/dist-es/util-identity-and-auth/memoizeIdentityProvider.js
var createIsIdentityExpiredFunction = /* @__PURE__ */ __name((expirationMs) => /* @__PURE__ */ __name(function isIdentityExpired2(identity) {
  return doesIdentityRequireRefresh(identity) && identity.expiration.getTime() - Date.now() < expirationMs;
}, "isIdentityExpired"), "createIsIdentityExpiredFunction");
var EXPIRATION_MS = 3e5;
var isIdentityExpired = createIsIdentityExpiredFunction(EXPIRATION_MS);
var doesIdentityRequireRefresh = /* @__PURE__ */ __name((identity) => identity.expiration !== void 0, "doesIdentityRequireRefresh");
var memoizeIdentityProvider = /* @__PURE__ */ __name((provider, isExpired, requiresRefresh) => {
  if (provider === void 0) {
    return void 0;
  }
  const normalizedProvider = typeof provider !== "function" ? async () => Promise.resolve(provider) : provider;
  let resolved;
  let pending;
  let hasResult;
  let isConstant = false;
  const coalesceProvider = /* @__PURE__ */ __name(async (options) => {
    if (!pending) {
      pending = normalizedProvider(options);
    }
    try {
      resolved = await pending;
      hasResult = true;
      isConstant = false;
    } finally {
      pending = void 0;
    }
    return resolved;
  }, "coalesceProvider");
  if (isExpired === void 0) {
    return async (options) => {
      if (!hasResult || options?.forceRefresh) {
        resolved = await coalesceProvider(options);
      }
      return resolved;
    };
  }
  return async (options) => {
    if (!hasResult || options?.forceRefresh) {
      resolved = await coalesceProvider(options);
    }
    if (isConstant) {
      return resolved;
    }
    if (!requiresRefresh(resolved)) {
      isConstant = true;
      return resolved;
    }
    if (isExpired(resolved)) {
      await coalesceProvider(options);
      return resolved;
    }
    return resolved;
  };
}, "memoizeIdentityProvider");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/configurations.js
var DEFAULT_UA_APP_ID = void 0;
function isValidUserAgentAppId(appId) {
  if (appId === void 0) {
    return true;
  }
  return typeof appId === "string" && appId.length <= 50;
}
__name(isValidUserAgentAppId, "isValidUserAgentAppId");
function resolveUserAgentConfig(input) {
  const normalizedAppIdProvider = normalizeProvider2(input.userAgentAppId ?? DEFAULT_UA_APP_ID);
  const { customUserAgent } = input;
  return Object.assign(input, {
    customUserAgent: typeof customUserAgent === "string" ? [[customUserAgent]] : customUserAgent,
    userAgentAppId: /* @__PURE__ */ __name(async () => {
      const appId = await normalizedAppIdProvider();
      if (!isValidUserAgentAppId(appId)) {
        const logger2 = input.logger?.constructor?.name === "NoOpLogger" || !input.logger ? console : input.logger;
        if (typeof appId !== "string") {
          logger2?.warn("userAgentAppId must be a string or undefined.");
        } else if (appId.length > 50) {
          logger2?.warn("The provided userAgentAppId exceeds the maximum length of 50 characters.");
        }
      }
      return appId;
    }, "userAgentAppId")
  });
}
__name(resolveUserAgentConfig, "resolveUserAgentConfig");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/user-agent-middleware.js
init_protocols();

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/aws/partitions.js
var partitionsInfo = { "partitions": [{ "id": "aws", "outputs": { "dnsSuffix": "amazonaws.com", "dualStackDnsSuffix": "api.aws", "implicitGlobalRegion": "us-east-1", "name": "aws", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^(us|eu|ap|sa|ca|me|af|il|mx)\\-\\w+\\-\\d+$", "regions": { "af-south-1": { "description": "Africa (Cape Town)" }, "ap-east-1": { "description": "Asia Pacific (Hong Kong)" }, "ap-east-2": { "description": "Asia Pacific (Taipei)" }, "ap-northeast-1": { "description": "Asia Pacific (Tokyo)" }, "ap-northeast-2": { "description": "Asia Pacific (Seoul)" }, "ap-northeast-3": { "description": "Asia Pacific (Osaka)" }, "ap-south-1": { "description": "Asia Pacific (Mumbai)" }, "ap-south-2": { "description": "Asia Pacific (Hyderabad)" }, "ap-southeast-1": { "description": "Asia Pacific (Singapore)" }, "ap-southeast-2": { "description": "Asia Pacific (Sydney)" }, "ap-southeast-3": { "description": "Asia Pacific (Jakarta)" }, "ap-southeast-4": { "description": "Asia Pacific (Melbourne)" }, "ap-southeast-5": { "description": "Asia Pacific (Malaysia)" }, "ap-southeast-6": { "description": "Asia Pacific (New Zealand)" }, "ap-southeast-7": { "description": "Asia Pacific (Thailand)" }, "aws-global": { "description": "aws global region" }, "ca-central-1": { "description": "Canada (Central)" }, "ca-west-1": { "description": "Canada West (Calgary)" }, "eu-central-1": { "description": "Europe (Frankfurt)" }, "eu-central-2": { "description": "Europe (Zurich)" }, "eu-north-1": { "description": "Europe (Stockholm)" }, "eu-south-1": { "description": "Europe (Milan)" }, "eu-south-2": { "description": "Europe (Spain)" }, "eu-west-1": { "description": "Europe (Ireland)" }, "eu-west-2": { "description": "Europe (London)" }, "eu-west-3": { "description": "Europe (Paris)" }, "il-central-1": { "description": "Israel (Tel Aviv)" }, "me-central-1": { "description": "Middle East (UAE)" }, "me-south-1": { "description": "Middle East (Bahrain)" }, "mx-central-1": { "description": "Mexico (Central)" }, "sa-east-1": { "description": "South America (Sao Paulo)" }, "us-east-1": { "description": "US East (N. Virginia)" }, "us-east-2": { "description": "US East (Ohio)" }, "us-west-1": { "description": "US West (N. California)" }, "us-west-2": { "description": "US West (Oregon)" } } }, { "id": "aws-cn", "outputs": { "dnsSuffix": "amazonaws.com.cn", "dualStackDnsSuffix": "api.amazonwebservices.com.cn", "implicitGlobalRegion": "cn-northwest-1", "name": "aws-cn", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^cn\\-\\w+\\-\\d+$", "regions": { "aws-cn-global": { "description": "aws-cn global region" }, "cn-north-1": { "description": "China (Beijing)" }, "cn-northwest-1": { "description": "China (Ningxia)" } } }, { "id": "aws-eusc", "outputs": { "dnsSuffix": "amazonaws.eu", "dualStackDnsSuffix": "api.amazonwebservices.eu", "implicitGlobalRegion": "eusc-de-east-1", "name": "aws-eusc", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^eusc\\-(de)\\-\\w+\\-\\d+$", "regions": { "eusc-de-east-1": { "description": "AWS European Sovereign Cloud (Germany)" } } }, { "id": "aws-iso", "outputs": { "dnsSuffix": "c2s.ic.gov", "dualStackDnsSuffix": "api.aws.ic.gov", "implicitGlobalRegion": "us-iso-east-1", "name": "aws-iso", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^us\\-iso\\-\\w+\\-\\d+$", "regions": { "aws-iso-global": { "description": "aws-iso global region" }, "us-iso-east-1": { "description": "US ISO East" }, "us-iso-west-1": { "description": "US ISO WEST" } } }, { "id": "aws-iso-b", "outputs": { "dnsSuffix": "sc2s.sgov.gov", "dualStackDnsSuffix": "api.aws.scloud", "implicitGlobalRegion": "us-isob-east-1", "name": "aws-iso-b", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^us\\-isob\\-\\w+\\-\\d+$", "regions": { "aws-iso-b-global": { "description": "aws-iso-b global region" }, "us-isob-east-1": { "description": "US ISOB East (Ohio)" }, "us-isob-west-1": { "description": "US ISOB West" } } }, { "id": "aws-iso-e", "outputs": { "dnsSuffix": "cloud.adc-e.uk", "dualStackDnsSuffix": "api.cloud-aws.adc-e.uk", "implicitGlobalRegion": "eu-isoe-west-1", "name": "aws-iso-e", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^eu\\-isoe\\-\\w+\\-\\d+$", "regions": { "aws-iso-e-global": { "description": "aws-iso-e global region" }, "eu-isoe-west-1": { "description": "EU ISOE West" } } }, { "id": "aws-iso-f", "outputs": { "dnsSuffix": "csp.hci.ic.gov", "dualStackDnsSuffix": "api.aws.hci.ic.gov", "implicitGlobalRegion": "us-isof-south-1", "name": "aws-iso-f", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^us\\-isof\\-\\w+\\-\\d+$", "regions": { "aws-iso-f-global": { "description": "aws-iso-f global region" }, "us-isof-east-1": { "description": "US ISOF EAST" }, "us-isof-south-1": { "description": "US ISOF SOUTH" } } }, { "id": "aws-us-gov", "outputs": { "dnsSuffix": "amazonaws.com", "dualStackDnsSuffix": "api.aws", "implicitGlobalRegion": "us-gov-west-1", "name": "aws-us-gov", "supportsDualStack": true, "supportsFIPS": true }, "regionRegex": "^us\\-gov\\-\\w+\\-\\d+$", "regions": { "aws-us-gov-global": { "description": "aws-us-gov global region" }, "us-gov-east-1": { "description": "AWS GovCloud (US-East)" }, "us-gov-west-1": { "description": "AWS GovCloud (US-West)" } } }], "version": "1.1" };

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/aws/partition.js
var selectedPartitionsInfo = partitionsInfo;
var selectedUserAgentPrefix = "";
var partition = /* @__PURE__ */ __name((value) => {
  const { partitions } = selectedPartitionsInfo;
  for (const partition2 of partitions) {
    const { regions, outputs } = partition2;
    for (const [region, regionData] of Object.entries(regions)) {
      if (region === value) {
        return {
          ...outputs,
          ...regionData
        };
      }
    }
  }
  for (const partition2 of partitions) {
    const { regionRegex, outputs } = partition2;
    if (new RegExp(regionRegex).test(value)) {
      return {
        ...outputs
      };
    }
  }
  const DEFAULT_PARTITION = partitions.find((partition2) => partition2.id === "aws");
  if (!DEFAULT_PARTITION) {
    throw new Error("Provided region was not found in the partition array or regex, and default partition with id 'aws' doesn't exist.");
  }
  return {
    ...DEFAULT_PARTITION.outputs
  };
}, "partition");
var getUserAgentPrefix = /* @__PURE__ */ __name(() => selectedUserAgentPrefix, "getUserAgentPrefix");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/check-features.js
var ACCOUNT_ID_ENDPOINT_REGEX = /\d{12}\.ddb/;
async function checkFeatures(context, config, args) {
  const request = args.request;
  if (request?.headers?.["smithy-protocol"] === "rpc-v2-cbor") {
    setFeature2(context, "PROTOCOL_RPC_V2_CBOR", "M");
  }
  if (typeof config.retryStrategy === "function") {
    const retryStrategy = await config.retryStrategy();
    if (typeof retryStrategy.mode === "string") {
      switch (retryStrategy.mode) {
        case RETRY_MODES.ADAPTIVE:
          setFeature2(context, "RETRY_MODE_ADAPTIVE", "F");
          break;
        case RETRY_MODES.STANDARD:
          setFeature2(context, "RETRY_MODE_STANDARD", "E");
          break;
      }
    }
  }
  if (typeof config.accountIdEndpointMode === "function") {
    const endpointV2 = context.endpointV2;
    if (String(endpointV2?.url?.hostname).match(ACCOUNT_ID_ENDPOINT_REGEX)) {
      setFeature2(context, "ACCOUNT_ID_ENDPOINT", "O");
    }
    switch (await config.accountIdEndpointMode?.()) {
      case "disabled":
        setFeature2(context, "ACCOUNT_ID_MODE_DISABLED", "Q");
        break;
      case "preferred":
        setFeature2(context, "ACCOUNT_ID_MODE_PREFERRED", "P");
        break;
      case "required":
        setFeature2(context, "ACCOUNT_ID_MODE_REQUIRED", "R");
        break;
    }
  }
  const identity = context.__smithy_context?.selectedHttpAuthScheme?.identity;
  if (identity?.$source) {
    const credentials = identity;
    if (credentials.accountId) {
      setFeature2(context, "RESOLVED_ACCOUNT_ID", "T");
    }
    for (const [key, value] of Object.entries(credentials.$source ?? {})) {
      setFeature2(context, key, value);
    }
  }
}
__name(checkFeatures, "checkFeatures");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/constants.js
var USER_AGENT = "user-agent";
var X_AMZ_USER_AGENT = "x-amz-user-agent";
var SPACE = " ";
var UA_NAME_SEPARATOR = "/";
var UA_NAME_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w]/g;
var UA_VALUE_ESCAPE_REGEX = /[^!$%&'*+\-.^_`|~\w#]/g;
var UA_ESCAPE_CHAR = "-";

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/encode-features.js
var BYTE_LIMIT = 1024;
function encodeFeatures(features) {
  let buffer = "";
  for (const key in features) {
    const val = features[key];
    if (buffer.length + val.length + 1 <= BYTE_LIMIT) {
      if (buffer.length) {
        buffer += "," + val;
      } else {
        buffer += val;
      }
      continue;
    }
    break;
  }
  return buffer;
}
__name(encodeFeatures, "encodeFeatures");

// node_modules/@aws-sdk/core/dist-es/submodules/client/middleware-user-agent/user-agent-middleware.js
var userAgentMiddleware = /* @__PURE__ */ __name((options) => (next, context) => async (args) => {
  const { request } = args;
  if (!HttpRequest.isInstance(request)) {
    return next(args);
  }
  const { headers } = request;
  const userAgent = context?.userAgent?.map(escapeUserAgent) || [];
  const defaultUserAgent2 = (await options.defaultUserAgentProvider()).map(escapeUserAgent);
  await checkFeatures(context, options, args);
  const awsContext = context;
  defaultUserAgent2.push(`m/${encodeFeatures(Object.assign({}, context.__smithy_context?.features, awsContext.__aws_sdk_context?.features))}`);
  const customUserAgent = options?.customUserAgent?.map(escapeUserAgent) || [];
  const appId = await options.userAgentAppId();
  if (appId) {
    defaultUserAgent2.push(escapeUserAgent([`app`, `${appId}`]));
  }
  const prefix = getUserAgentPrefix();
  const sdkUserAgentValue = (prefix ? [prefix] : []).concat([...defaultUserAgent2, ...userAgent, ...customUserAgent]).join(SPACE);
  const normalUAValue = [
    ...defaultUserAgent2.filter((section) => section.startsWith("aws-sdk-")),
    ...customUserAgent
  ].join(SPACE);
  if (options.runtime !== "browser") {
    if (normalUAValue) {
      headers[X_AMZ_USER_AGENT] = headers[X_AMZ_USER_AGENT] ? `${headers[USER_AGENT]} ${normalUAValue}` : normalUAValue;
    }
    headers[USER_AGENT] = sdkUserAgentValue;
  } else {
    headers[X_AMZ_USER_AGENT] = sdkUserAgentValue;
  }
  return next({
    ...args,
    request
  });
}, "userAgentMiddleware");
var escapeUserAgent = /* @__PURE__ */ __name((userAgentPair) => {
  const name = userAgentPair[0].split(UA_NAME_SEPARATOR).map((part) => part.replace(UA_NAME_ESCAPE_REGEX, UA_ESCAPE_CHAR)).join(UA_NAME_SEPARATOR);
  const version = userAgentPair[1]?.replace(UA_VALUE_ESCAPE_REGEX, UA_ESCAPE_CHAR);
  const prefixSeparatorIndex = name.indexOf(UA_NAME_SEPARATOR);
  const prefix = name.substring(0, prefixSeparatorIndex);
  let uaName = name.substring(prefixSeparatorIndex + 1);
  if (prefix === "api") {
    uaName = uaName.toLowerCase();
  }
  return [prefix, uaName, version].filter((item) => item && item.length > 0).reduce((acc, item, index) => {
    switch (index) {
      case 0:
        return item;
      case 1:
        return `${acc}/${item}`;
      default:
        return `${acc}#${item}`;
    }
  }, "");
}, "escapeUserAgent");
var getUserAgentMiddlewareOptions = {
  name: "getUserAgentMiddleware",
  step: "build",
  priority: "low",
  tags: ["SET_USER_AGENT", "USER_AGENT"],
  override: true
};
var getUserAgentPlugin = /* @__PURE__ */ __name((config) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(userAgentMiddleware(config), getUserAgentMiddlewareOptions);
  }, "applyToStack")
}), "getUserAgentPlugin");

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-user-agent-browser/defaultUserAgent.js
var createDefaultUserAgentProvider = /* @__PURE__ */ __name(({ serviceId, clientVersion }) => async (config) => {
  const navigator = typeof window !== "undefined" ? window.navigator : void 0;
  const uaString = navigator?.userAgent ?? "";
  const osName = navigator?.userAgentData?.platform ?? fallback.os(uaString) ?? "other";
  const osVersion = void 0;
  const brands = navigator?.userAgentData?.brands ?? [];
  const brand = brands[brands.length - 1];
  const browserName = brand?.brand ?? fallback.browser(uaString) ?? "unknown";
  const browserVersion = brand?.version ?? "unknown";
  const sections = [
    ["aws-sdk-js", clientVersion],
    ["ua", "2.1"],
    [`os/${osName}`, osVersion],
    ["lang/js"],
    ["md/browser", `${browserName}_${browserVersion}`]
  ];
  if (serviceId) {
    sections.push([`api/${serviceId}`, clientVersion]);
  }
  const appId = await config?.userAgentAppId?.();
  if (appId) {
    sections.push([`app/${appId}`]);
  }
  return sections;
}, "createDefaultUserAgentProvider");
var fallback = {
  os(ua) {
    if (/iPhone|iPad|iPod/.test(ua))
      return "iOS";
    if (/Macintosh|Mac OS X/.test(ua))
      return "macOS";
    if (/Windows NT/.test(ua))
      return "Windows";
    if (/Android/.test(ua))
      return "Android";
    if (/Linux/.test(ua))
      return "Linux";
    return void 0;
  },
  browser(ua) {
    if (/EdgiOS|EdgA|Edg\//.test(ua))
      return "Microsoft Edge";
    if (/Firefox\//.test(ua))
      return "Firefox";
    if (/Chrome\//.test(ua))
      return "Chrome";
    if (/Safari\//.test(ua))
      return "Safari";
    return void 0;
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/aws.js
init_index_browser();

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/aws/isVirtualHostableS3Bucket.js
init_index_browser();

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/isIpAddress.js
init_index_browser();

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/aws/isVirtualHostableS3Bucket.js
var isVirtualHostableS3Bucket = /* @__PURE__ */ __name((value, allowSubDomains = false) => {
  if (allowSubDomains) {
    for (const label of value.split(".")) {
      if (!isVirtualHostableS3Bucket(label)) {
        return false;
      }
    }
    return true;
  }
  if (!isValidHostLabel(value)) {
    return false;
  }
  if (value.length < 3 || value.length > 63) {
    return false;
  }
  if (value !== value.toLowerCase()) {
    return false;
  }
  if (isIpAddress(value)) {
    return false;
  }
  return true;
}, "isVirtualHostableS3Bucket");

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/lib/aws/parseArn.js
var ARN_DELIMITER = ":";
var RESOURCE_DELIMITER = "/";
var parseArn = /* @__PURE__ */ __name((value) => {
  const segments = value.split(ARN_DELIMITER);
  if (segments.length < 6)
    return null;
  const [arn, partition2, service, region, accountId, ...resourcePath] = segments;
  if (arn !== "arn" || partition2 === "" || service === "" || resourcePath.join(ARN_DELIMITER) === "")
    return null;
  const resourceId = resourcePath.map((resource) => resource.split(RESOURCE_DELIMITER)).flat();
  return {
    partition: partition2,
    service,
    region,
    accountId,
    resourceId
  };
}, "parseArn");

// node_modules/@aws-sdk/core/dist-es/submodules/client/util-endpoints/aws.js
var awsEndpointFunctions = {
  isVirtualHostableS3Bucket,
  parseArn,
  partition
};
customEndpointFunctions.aws = awsEndpointFunctions;

// node_modules/@smithy/core/dist-es/submodules/config/property-provider/memoize.js
var memoize = /* @__PURE__ */ __name((provider, isExpired, requiresRefresh) => {
  let resolved;
  let pending;
  let hasResult;
  let isConstant = false;
  const coalesceProvider = /* @__PURE__ */ __name(async () => {
    if (!pending) {
      pending = provider();
    }
    try {
      resolved = await pending;
      hasResult = true;
      isConstant = false;
    } finally {
      pending = void 0;
    }
    return resolved;
  }, "coalesceProvider");
  if (isExpired === void 0) {
    return async (options) => {
      if (!hasResult || options?.forceRefresh) {
        resolved = await coalesceProvider();
      }
      return resolved;
    };
  }
  return async (options) => {
    if (!hasResult || options?.forceRefresh) {
      resolved = await coalesceProvider();
    }
    if (isConstant) {
      return resolved;
    }
    if (requiresRefresh && !requiresRefresh(resolved)) {
      isConstant = true;
      return resolved;
    }
    if (isExpired(resolved)) {
      await coalesceProvider();
      return resolved;
    }
    return resolved;
  };
}, "memoize");

// node_modules/@smithy/core/dist-es/submodules/config/config-resolver/regionConfig/checkRegion.js
init_index_browser();
var validRegions = /* @__PURE__ */ new Set();
var checkRegion = /* @__PURE__ */ __name((region, check = isValidHostLabel) => {
  if (!validRegions.has(region) && !check(region)) {
    if (region === "*") {
      console.warn(`@smithy/config-resolver WARN - Please use the caller region instead of "*". See "sigv4a" in https://github.com/aws/aws-sdk-js-v3/blob/main/supplemental-docs/CLIENTS.md.`);
    } else {
      throw new Error(`Region not accepted: region="${region}" is not a valid hostname component.`);
    }
  } else {
    validRegions.add(region);
  }
}, "checkRegion");

// node_modules/@smithy/core/dist-es/submodules/config/config-resolver/regionConfig/isFipsRegion.js
var isFipsRegion = /* @__PURE__ */ __name((region) => typeof region === "string" && (region.startsWith("fips-") || region.endsWith("-fips")), "isFipsRegion");

// node_modules/@smithy/core/dist-es/submodules/config/config-resolver/regionConfig/getRealRegion.js
var getRealRegion = /* @__PURE__ */ __name((region) => isFipsRegion(region) ? ["fips-aws-global", "aws-fips"].includes(region) ? "us-east-1" : region.replace(/fips-(dkr-|prod-)?|-fips/, "") : region, "getRealRegion");

// node_modules/@smithy/core/dist-es/submodules/config/config-resolver/regionConfig/resolveRegionConfig.js
var resolveRegionConfig = /* @__PURE__ */ __name((input) => {
  const { region, useFipsEndpoint } = input;
  if (!region) {
    throw new Error("Region is missing");
  }
  return Object.assign(input, {
    region: /* @__PURE__ */ __name(async () => {
      const providedRegion = typeof region === "function" ? await region() : region;
      const realRegion = getRealRegion(providedRegion);
      checkRegion(realRegion);
      return realRegion;
    }, "region"),
    useFipsEndpoint: /* @__PURE__ */ __name(async () => {
      const providedRegion = typeof region === "string" ? region : await region();
      if (isFipsRegion(providedRegion)) {
        return true;
      }
      return typeof useFipsEndpoint !== "function" ? Promise.resolve(!!useFipsEndpoint) : useFipsEndpoint();
    }, "useFipsEndpoint")
  });
}, "resolveRegionConfig");

// node_modules/@smithy/core/dist-es/submodules/config/defaults-mode/constants.js
var DEFAULTS_MODE_OPTIONS = ["in-region", "cross-region", "mobile", "standard", "legacy"];

// node_modules/@smithy/core/dist-es/submodules/config/defaults-mode/resolveDefaultsModeConfig.browser.js
var resolveDefaultsModeConfig = /* @__PURE__ */ __name(({ defaultsMode } = {}) => memoize(async () => {
  const mode = typeof defaultsMode === "function" ? await defaultsMode() : defaultsMode;
  switch (mode?.toLowerCase()) {
    case "auto":
      return Promise.resolve(useMobileConfiguration() ? "mobile" : "standard");
    case "mobile":
    case "in-region":
    case "cross-region":
    case "standard":
    case "legacy":
      return Promise.resolve(mode?.toLocaleLowerCase());
    case void 0:
      return Promise.resolve("legacy");
    default:
      throw new Error(`Invalid parameter for "defaultsMode", expect ${DEFAULTS_MODE_OPTIONS.join(", ")}, got ${mode}`);
  }
}), "resolveDefaultsModeConfig");
var useMobileConfiguration = /* @__PURE__ */ __name(() => {
  const navigator = window?.navigator;
  if (navigator?.connection) {
    const { effectiveType, rtt, downlink } = navigator?.connection;
    const slow = typeof effectiveType === "string" && effectiveType !== "4g" || Number(rtt) > 100 || Number(downlink) < 10;
    if (slow) {
      return true;
    }
  }
  return navigator?.userAgentData?.mobile || typeof navigator?.maxTouchPoints === "number" && navigator?.maxTouchPoints > 1;
}, "useMobileConfiguration");

// node_modules/@smithy/core/dist-es/submodules/config/index.browser.js
var DEFAULT_USE_DUALSTACK_ENDPOINT = false;
var DEFAULT_USE_FIPS_ENDPOINT = false;

// node_modules/@aws-sdk/core/dist-es/submodules/client/region-config-resolver/extensions.js
var getAwsRegionExtensionConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
  return {
    setRegion(region) {
      runtimeConfig.region = region;
    },
    region() {
      return runtimeConfig.region;
    }
  };
}, "getAwsRegionExtensionConfiguration");
var resolveAwsRegionExtensionConfiguration = /* @__PURE__ */ __name((awsRegionExtensionConfiguration) => {
  return {
    region: awsRegionExtensionConfiguration.region()
  };
}, "resolveAwsRegionExtensionConfiguration");

// node_modules/@aws-sdk/middleware-expect-continue/dist-es/index.js
init_protocols();
function addExpectContinueMiddleware(options) {
  return (next) => async (args) => {
    const { request } = args;
    if (options.expectContinueHeader !== false && HttpRequest.isInstance(request) && request.body && options.runtime === "node" && options.requestHandler?.constructor?.name !== "FetchHttpHandler") {
      let sendHeader = true;
      if (typeof options.expectContinueHeader === "number") {
        try {
          const bodyLength = Number(request.headers?.["content-length"]) ?? options.bodyLengthChecker?.(request.body) ?? Infinity;
          sendHeader = bodyLength >= options.expectContinueHeader;
        } catch (e2) {
        }
      } else {
        sendHeader = !!options.expectContinueHeader;
      }
      if (sendHeader) {
        request.headers.Expect = "100-continue";
      }
    }
    return next({
      ...args,
      request
    });
  };
}
__name(addExpectContinueMiddleware, "addExpectContinueMiddleware");
var addExpectContinueMiddlewareOptions = {
  step: "build",
  tags: ["SET_EXPECT_HEADER", "EXPECT_HEADER"],
  name: "addExpectContinueMiddleware",
  override: true
};
var getAddExpectContinuePlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(addExpectContinueMiddleware(options), addExpectContinueMiddlewareOptions);
  }, "applyToStack")
}), "getAddExpectContinuePlugin");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/constants.js
var RequestChecksumCalculation = {
  WHEN_SUPPORTED: "WHEN_SUPPORTED",
  WHEN_REQUIRED: "WHEN_REQUIRED"
};
var DEFAULT_REQUEST_CHECKSUM_CALCULATION = RequestChecksumCalculation.WHEN_SUPPORTED;
var ResponseChecksumValidation = {
  WHEN_SUPPORTED: "WHEN_SUPPORTED",
  WHEN_REQUIRED: "WHEN_REQUIRED"
};
var DEFAULT_RESPONSE_CHECKSUM_VALIDATION = RequestChecksumCalculation.WHEN_SUPPORTED;
var ChecksumAlgorithm;
(function(ChecksumAlgorithm2) {
  ChecksumAlgorithm2["MD5"] = "MD5";
  ChecksumAlgorithm2["CRC32"] = "CRC32";
  ChecksumAlgorithm2["CRC32C"] = "CRC32C";
  ChecksumAlgorithm2["CRC64NVME"] = "CRC64NVME";
  ChecksumAlgorithm2["SHA1"] = "SHA1";
  ChecksumAlgorithm2["SHA256"] = "SHA256";
})(ChecksumAlgorithm || (ChecksumAlgorithm = {}));
var ChecksumLocation;
(function(ChecksumLocation2) {
  ChecksumLocation2["HEADER"] = "header";
  ChecksumLocation2["TRAILER"] = "trailer";
})(ChecksumLocation || (ChecksumLocation = {}));
var DEFAULT_CHECKSUM_ALGORITHM = ChecksumAlgorithm.CRC32;

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/flexibleChecksumsMiddleware.js
init_protocols();
init_index_browser2();

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getChecksumAlgorithmForRequest.js
var getChecksumAlgorithmForRequest = /* @__PURE__ */ __name((input, { requestChecksumRequired, requestAlgorithmMember, requestChecksumCalculation }) => {
  if (!requestAlgorithmMember) {
    return requestChecksumCalculation === RequestChecksumCalculation.WHEN_SUPPORTED || requestChecksumRequired ? DEFAULT_CHECKSUM_ALGORITHM : void 0;
  }
  if (!input[requestAlgorithmMember]) {
    return void 0;
  }
  const checksumAlgorithm = input[requestAlgorithmMember];
  return checksumAlgorithm;
}, "getChecksumAlgorithmForRequest");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getChecksumLocationName.js
var getChecksumLocationName = /* @__PURE__ */ __name((algorithm) => algorithm === ChecksumAlgorithm.MD5 ? "content-md5" : `x-amz-checksum-${algorithm.toLowerCase()}`, "getChecksumLocationName");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/hasHeader.js
var hasHeader = /* @__PURE__ */ __name((header, headers) => {
  const soughtHeader = header.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (soughtHeader === headerName.toLowerCase()) {
      return true;
    }
  }
  return false;
}, "hasHeader");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/hasHeaderWithPrefix.js
var hasHeaderWithPrefix = /* @__PURE__ */ __name((headerPrefix, headers) => {
  const soughtHeaderPrefix = headerPrefix.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (headerName.toLowerCase().startsWith(soughtHeaderPrefix)) {
      return true;
    }
  }
  return false;
}, "hasHeaderWithPrefix");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/isStreaming.js
init_index_browser2();
var isStreaming = /* @__PURE__ */ __name((body) => body !== void 0 && typeof body !== "string" && !ArrayBuffer.isView(body) && !isArrayBuffer(body), "isStreaming");

// node_modules/@aws-crypto/crc32c/build/module/index.js
init_tslib_es6();
init_module();

// node_modules/@aws-crypto/crc32c/build/module/aws_crc32c.js
init_tslib_es6();
init_module();
var AwsCrc32c = (
  /** @class */
  (function() {
    function AwsCrc32c2() {
      this.crc32c = new Crc32c();
    }
    __name(AwsCrc32c2, "AwsCrc32c");
    AwsCrc32c2.prototype.update = function(toHash) {
      if (isEmptyData(toHash))
        return;
      this.crc32c.update(convertToBuffer(toHash));
    };
    AwsCrc32c2.prototype.digest = function() {
      return __awaiter(this, void 0, void 0, function() {
        return __generator(this, function(_a) {
          return [2, numToUint8(this.crc32c.digest())];
        });
      });
    };
    AwsCrc32c2.prototype.reset = function() {
      this.crc32c = new Crc32c();
    };
    return AwsCrc32c2;
  })()
);

// node_modules/@aws-crypto/crc32c/build/module/index.js
var Crc32c = (
  /** @class */
  (function() {
    function Crc32c2() {
      this.checksum = 4294967295;
    }
    __name(Crc32c2, "Crc32c");
    Crc32c2.prototype.update = function(data) {
      var e_1, _a;
      try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
          var byte = data_1_1.value;
          this.checksum = this.checksum >>> 8 ^ lookupTable2[(this.checksum ^ byte) & 255];
        }
      } catch (e_1_1) {
        e_1 = { error: e_1_1 };
      } finally {
        try {
          if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        } finally {
          if (e_1) throw e_1.error;
        }
      }
      return this;
    };
    Crc32c2.prototype.digest = function() {
      return (this.checksum ^ 4294967295) >>> 0;
    };
    return Crc32c2;
  })()
);
var a_lookupTable = [
  0,
  4067132163,
  3778769143,
  324072436,
  3348797215,
  904991772,
  648144872,
  3570033899,
  2329499855,
  2024987596,
  1809983544,
  2575936315,
  1296289744,
  3207089363,
  2893594407,
  1578318884,
  274646895,
  3795141740,
  4049975192,
  51262619,
  3619967088,
  632279923,
  922689671,
  3298075524,
  2592579488,
  1760304291,
  2075979607,
  2312596564,
  1562183871,
  2943781820,
  3156637768,
  1313733451,
  549293790,
  3537243613,
  3246849577,
  871202090,
  3878099393,
  357341890,
  102525238,
  4101499445,
  2858735121,
  1477399826,
  1264559846,
  3107202533,
  1845379342,
  2677391885,
  2361733625,
  2125378298,
  820201905,
  3263744690,
  3520608582,
  598981189,
  4151959214,
  85089709,
  373468761,
  3827903834,
  3124367742,
  1213305469,
  1526817161,
  2842354314,
  2107672161,
  2412447074,
  2627466902,
  1861252501,
  1098587580,
  3004210879,
  2688576843,
  1378610760,
  2262928035,
  1955203488,
  1742404180,
  2511436119,
  3416409459,
  969524848,
  714683780,
  3639785095,
  205050476,
  4266873199,
  3976438427,
  526918040,
  1361435347,
  2739821008,
  2954799652,
  1114974503,
  2529119692,
  1691668175,
  2005155131,
  2247081528,
  3690758684,
  697762079,
  986182379,
  3366744552,
  476452099,
  3993867776,
  4250756596,
  255256311,
  1640403810,
  2477592673,
  2164122517,
  1922457750,
  2791048317,
  1412925310,
  1197962378,
  3037525897,
  3944729517,
  427051182,
  170179418,
  4165941337,
  746937522,
  3740196785,
  3451792453,
  1070968646,
  1905808397,
  2213795598,
  2426610938,
  1657317369,
  3053634322,
  1147748369,
  1463399397,
  2773627110,
  4215344322,
  153784257,
  444234805,
  3893493558,
  1021025245,
  3467647198,
  3722505002,
  797665321,
  2197175160,
  1889384571,
  1674398607,
  2443626636,
  1164749927,
  3070701412,
  2757221520,
  1446797203,
  137323447,
  4198817972,
  3910406976,
  461344835,
  3484808360,
  1037989803,
  781091935,
  3705997148,
  2460548119,
  1623424788,
  1939049696,
  2180517859,
  1429367560,
  2807687179,
  3020495871,
  1180866812,
  410100952,
  3927582683,
  4182430767,
  186734380,
  3756733383,
  763408580,
  1053836080,
  3434856499,
  2722870694,
  1344288421,
  1131464017,
  2971354706,
  1708204729,
  2545590714,
  2229949006,
  1988219213,
  680717673,
  3673779818,
  3383336350,
  1002577565,
  4010310262,
  493091189,
  238226049,
  4233660802,
  2987750089,
  1082061258,
  1395524158,
  2705686845,
  1972364758,
  2279892693,
  2494862625,
  1725896226,
  952904198,
  3399985413,
  3656866545,
  731699698,
  4283874585,
  222117402,
  510512622,
  3959836397,
  3280807620,
  837199303,
  582374963,
  3504198960,
  68661723,
  4135334616,
  3844915500,
  390545967,
  1230274059,
  3141532936,
  2825850620,
  1510247935,
  2395924756,
  2091215383,
  1878366691,
  2644384480,
  3553878443,
  565732008,
  854102364,
  3229815391,
  340358836,
  3861050807,
  4117890627,
  119113024,
  1493875044,
  2875275879,
  3090270611,
  1247431312,
  2660249211,
  1828433272,
  2141937292,
  2378227087,
  3811616794,
  291187481,
  34330861,
  4032846830,
  615137029,
  3603020806,
  3314634738,
  939183345,
  1776939221,
  2609017814,
  2295496738,
  2058945313,
  2926798794,
  1545135305,
  1330124605,
  3173225534,
  4084100981,
  17165430,
  307568514,
  3762199681,
  888469610,
  3332340585,
  3587147933,
  665062302,
  2042050490,
  2346497209,
  2559330125,
  1793573966,
  3190661285,
  1279665062,
  1595330642,
  2910671697
];
var lookupTable2 = uint32ArrayFrom(a_lookupTable);

// node_modules/@aws-sdk/crc64-nvme/dist-es/Crc64Nvme.js
var generateCRC64NVMETable = /* @__PURE__ */ __name(() => {
  const sliceLength = 8;
  const tables = new Array(sliceLength);
  for (let slice = 0; slice < sliceLength; slice++) {
    const table = new Array(512);
    for (let i2 = 0; i2 < 256; i2++) {
      let crc = BigInt(i2);
      for (let j2 = 0; j2 < 8 * (slice + 1); j2++) {
        if (crc & 1n) {
          crc = crc >> 1n ^ 0x9a6c9329ac4bc9b5n;
        } else {
          crc = crc >> 1n;
        }
      }
      table[i2 * 2] = Number(crc >> 32n & 0xffffffffn);
      table[i2 * 2 + 1] = Number(crc & 0xffffffffn);
    }
    tables[slice] = new Uint32Array(table);
  }
  return tables;
}, "generateCRC64NVMETable");
var CRC64_NVME_REVERSED_TABLE;
var t0;
var t1;
var t2;
var t3;
var t4;
var t5;
var t6;
var t7;
var ensureTablesInitialized = /* @__PURE__ */ __name(() => {
  if (!CRC64_NVME_REVERSED_TABLE) {
    CRC64_NVME_REVERSED_TABLE = generateCRC64NVMETable();
    [t0, t1, t2, t3, t4, t5, t6, t7] = CRC64_NVME_REVERSED_TABLE;
  }
}, "ensureTablesInitialized");
var Crc64Nvme = class {
  static {
    __name(this, "Crc64Nvme");
  }
  c1 = 0;
  c2 = 0;
  constructor() {
    ensureTablesInitialized();
    this.reset();
  }
  update(data) {
    const len = data.length;
    let i2 = 0;
    let crc1 = this.c1;
    let crc2 = this.c2;
    while (i2 + 8 <= len) {
      const idx0 = ((crc2 ^ data[i2++]) & 255) << 1;
      const idx1 = ((crc2 >>> 8 ^ data[i2++]) & 255) << 1;
      const idx2 = ((crc2 >>> 16 ^ data[i2++]) & 255) << 1;
      const idx3 = ((crc2 >>> 24 ^ data[i2++]) & 255) << 1;
      const idx4 = ((crc1 ^ data[i2++]) & 255) << 1;
      const idx5 = ((crc1 >>> 8 ^ data[i2++]) & 255) << 1;
      const idx6 = ((crc1 >>> 16 ^ data[i2++]) & 255) << 1;
      const idx7 = ((crc1 >>> 24 ^ data[i2++]) & 255) << 1;
      crc1 = t7[idx0] ^ t6[idx1] ^ t5[idx2] ^ t4[idx3] ^ t3[idx4] ^ t2[idx5] ^ t1[idx6] ^ t0[idx7];
      crc2 = t7[idx0 + 1] ^ t6[idx1 + 1] ^ t5[idx2 + 1] ^ t4[idx3 + 1] ^ t3[idx4 + 1] ^ t2[idx5 + 1] ^ t1[idx6 + 1] ^ t0[idx7 + 1];
    }
    while (i2 < len) {
      const idx = ((crc2 ^ data[i2]) & 255) << 1;
      crc2 = (crc2 >>> 8 | (crc1 & 255) << 24) >>> 0;
      crc1 = crc1 >>> 8 ^ t0[idx];
      crc2 ^= t0[idx + 1];
      i2++;
    }
    this.c1 = crc1;
    this.c2 = crc2;
  }
  async digest() {
    const c1 = this.c1 ^ 4294967295;
    const c2 = this.c2 ^ 4294967295;
    return new Uint8Array([
      c1 >>> 24,
      c1 >>> 16 & 255,
      c1 >>> 8 & 255,
      c1 & 255,
      c2 >>> 24,
      c2 >>> 16 & 255,
      c2 >>> 8 & 255,
      c2 & 255
    ]);
  }
  reset() {
    this.c1 = 4294967295;
    this.c2 = 4294967295;
  }
};

// node_modules/@aws-sdk/crc64-nvme/dist-es/crc64-nvme-crt-container.js
var crc64NvmeCrtContainer = {
  CrtCrc64Nvme: null
};

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getCrc32ChecksumAlgorithmFunction.browser.js
init_module2();
var getCrc32ChecksumAlgorithmFunction = /* @__PURE__ */ __name(() => AwsCrc32, "getCrc32ChecksumAlgorithmFunction");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/types.js
var CLIENT_SUPPORTED_ALGORITHMS = [
  ChecksumAlgorithm.CRC32,
  ChecksumAlgorithm.CRC32C,
  ChecksumAlgorithm.CRC64NVME,
  ChecksumAlgorithm.SHA1,
  ChecksumAlgorithm.SHA256
];
var PRIORITY_ORDER_ALGORITHMS = [
  ChecksumAlgorithm.SHA256,
  ChecksumAlgorithm.SHA1,
  ChecksumAlgorithm.CRC32,
  ChecksumAlgorithm.CRC32C,
  ChecksumAlgorithm.CRC64NVME
];

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/selectChecksumAlgorithmFunction.js
var selectChecksumAlgorithmFunction = /* @__PURE__ */ __name((checksumAlgorithm, config) => {
  const { checksumAlgorithms = {} } = config;
  switch (checksumAlgorithm) {
    case ChecksumAlgorithm.MD5:
      return checksumAlgorithms?.MD5 ?? config.md5;
    case ChecksumAlgorithm.CRC32:
      return checksumAlgorithms?.CRC32 ?? getCrc32ChecksumAlgorithmFunction();
    case ChecksumAlgorithm.CRC32C:
      return checksumAlgorithms?.CRC32C ?? AwsCrc32c;
    case ChecksumAlgorithm.CRC64NVME:
      if (typeof crc64NvmeCrtContainer.CrtCrc64Nvme !== "function") {
        return checksumAlgorithms?.CRC64NVME ?? Crc64Nvme;
      }
      return checksumAlgorithms?.CRC64NVME ?? crc64NvmeCrtContainer.CrtCrc64Nvme;
    case ChecksumAlgorithm.SHA1:
      return checksumAlgorithms?.SHA1 ?? config.sha1;
    case ChecksumAlgorithm.SHA256:
      return checksumAlgorithms?.SHA256 ?? config.sha256;
    default:
      if (checksumAlgorithms?.[checksumAlgorithm]) {
        return checksumAlgorithms[checksumAlgorithm];
      }
      throw new Error(`The checksum algorithm "${checksumAlgorithm}" is not supported by the client. Select one of ${CLIENT_SUPPORTED_ALGORITHMS}, or provide an implementation to  the client constructor checksums field.`);
  }
}, "selectChecksumAlgorithmFunction");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/stringHasher.js
init_index_browser2();
var stringHasher = /* @__PURE__ */ __name((checksumAlgorithmFn, body) => {
  const hash = new checksumAlgorithmFn();
  hash.update(toUint8Array(body || ""));
  return hash.digest();
}, "stringHasher");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/flexibleChecksumsMiddleware.js
var flexibleChecksumsMiddlewareOptions = {
  name: "flexibleChecksumsMiddleware",
  step: "build",
  tags: ["BODY_CHECKSUM"],
  override: true
};
var flexibleChecksumsMiddleware = /* @__PURE__ */ __name((config, middlewareConfig) => (next, context) => async (args) => {
  if (!HttpRequest.isInstance(args.request)) {
    return next(args);
  }
  if (hasHeaderWithPrefix("x-amz-checksum-", args.request.headers)) {
    return next(args);
  }
  const { request, input } = args;
  const { body: requestBody, headers } = request;
  const { base64Encoder, streamHasher } = config;
  const { requestChecksumRequired, requestAlgorithmMember } = middlewareConfig;
  const requestChecksumCalculation = await config.requestChecksumCalculation();
  const requestAlgorithmMemberName = requestAlgorithmMember?.name;
  const requestAlgorithmMemberHttpHeader = requestAlgorithmMember?.httpHeader;
  if (requestAlgorithmMemberName && !input[requestAlgorithmMemberName]) {
    if (requestChecksumCalculation === RequestChecksumCalculation.WHEN_SUPPORTED || requestChecksumRequired) {
      input[requestAlgorithmMemberName] = DEFAULT_CHECKSUM_ALGORITHM;
      if (requestAlgorithmMemberHttpHeader) {
        headers[requestAlgorithmMemberHttpHeader] = DEFAULT_CHECKSUM_ALGORITHM;
      }
    }
  }
  const checksumAlgorithm = getChecksumAlgorithmForRequest(input, {
    requestChecksumRequired,
    requestAlgorithmMember: requestAlgorithmMember?.name,
    requestChecksumCalculation
  });
  let updatedBody = requestBody;
  let updatedHeaders = headers;
  if (checksumAlgorithm) {
    switch (checksumAlgorithm) {
      case ChecksumAlgorithm.CRC32:
        setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_CRC32", "U");
        break;
      case ChecksumAlgorithm.CRC32C:
        setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_CRC32C", "V");
        break;
      case ChecksumAlgorithm.CRC64NVME:
        setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_CRC64", "W");
        break;
      case ChecksumAlgorithm.SHA1:
        setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_SHA1", "X");
        break;
      case ChecksumAlgorithm.SHA256:
        setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_SHA256", "Y");
        break;
    }
    const checksumLocationName = getChecksumLocationName(checksumAlgorithm);
    const checksumAlgorithmFn = selectChecksumAlgorithmFunction(checksumAlgorithm, config);
    if (isStreaming(requestBody)) {
      const { getAwsChunkedEncodingStream: getAwsChunkedEncodingStream2, bodyLengthChecker } = config;
      updatedBody = getAwsChunkedEncodingStream2(typeof config.requestStreamBufferSize === "number" && config.requestStreamBufferSize >= 8 * 1024 ? createBufferedReadable(requestBody, config.requestStreamBufferSize, context.logger) : requestBody, {
        base64Encoder,
        bodyLengthChecker,
        checksumLocationName,
        checksumAlgorithmFn,
        streamHasher
      });
      updatedHeaders = {
        ...headers,
        "content-encoding": headers["content-encoding"] ? `${headers["content-encoding"]},aws-chunked` : "aws-chunked",
        "transfer-encoding": "chunked",
        "x-amz-decoded-content-length": headers["content-length"],
        "x-amz-content-sha256": "STREAMING-UNSIGNED-PAYLOAD-TRAILER",
        "x-amz-trailer": checksumLocationName
      };
      delete updatedHeaders["content-length"];
    } else if (!hasHeader(checksumLocationName, headers)) {
      const rawChecksum = await stringHasher(checksumAlgorithmFn, requestBody);
      updatedHeaders = {
        ...headers,
        [checksumLocationName]: base64Encoder(rawChecksum)
      };
    }
  }
  try {
    const result = await next({
      ...args,
      request: {
        ...request,
        headers: updatedHeaders,
        body: updatedBody
      }
    });
    return result;
  } catch (e2) {
    if (e2 instanceof Error && e2.name === "InvalidChunkSizeError") {
      try {
        if (!e2.message.endsWith(".")) {
          e2.message += ".";
        }
        e2.message += " Set [requestStreamBufferSize=number e.g. 65_536] in client constructor to instruct AWS SDK to buffer your input stream.";
      } catch (ignored) {
      }
    }
    throw e2;
  }
}, "flexibleChecksumsMiddleware");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/flexibleChecksumsInputMiddleware.js
var flexibleChecksumsInputMiddlewareOptions = {
  name: "flexibleChecksumsInputMiddleware",
  toMiddleware: "serializerMiddleware",
  relation: "before",
  tags: ["BODY_CHECKSUM"],
  override: true
};
var flexibleChecksumsInputMiddleware = /* @__PURE__ */ __name((config, middlewareConfig) => (next, context) => async (args) => {
  const input = args.input;
  const { requestValidationModeMember } = middlewareConfig;
  const requestChecksumCalculation = await config.requestChecksumCalculation();
  const responseChecksumValidation = await config.responseChecksumValidation();
  switch (requestChecksumCalculation) {
    case RequestChecksumCalculation.WHEN_REQUIRED:
      setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_WHEN_REQUIRED", "a");
      break;
    case RequestChecksumCalculation.WHEN_SUPPORTED:
      setFeature2(context, "FLEXIBLE_CHECKSUMS_REQ_WHEN_SUPPORTED", "Z");
      break;
  }
  switch (responseChecksumValidation) {
    case ResponseChecksumValidation.WHEN_REQUIRED:
      setFeature2(context, "FLEXIBLE_CHECKSUMS_RES_WHEN_REQUIRED", "c");
      break;
    case ResponseChecksumValidation.WHEN_SUPPORTED:
      setFeature2(context, "FLEXIBLE_CHECKSUMS_RES_WHEN_SUPPORTED", "b");
      break;
  }
  if (requestValidationModeMember && !input[requestValidationModeMember]) {
    if (responseChecksumValidation === ResponseChecksumValidation.WHEN_SUPPORTED) {
      input[requestValidationModeMember] = "ENABLED";
    }
  }
  return next(args);
}, "flexibleChecksumsInputMiddleware");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/flexibleChecksumsResponseMiddleware.js
init_protocols();

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getChecksumAlgorithmListForResponse.js
var getChecksumAlgorithmListForResponse = /* @__PURE__ */ __name((responseAlgorithms = []) => {
  const validChecksumAlgorithms = [];
  let i2 = PRIORITY_ORDER_ALGORITHMS.length;
  for (const algorithm of responseAlgorithms) {
    const priority = PRIORITY_ORDER_ALGORITHMS.indexOf(algorithm);
    if (priority !== -1) {
      validChecksumAlgorithms[priority] = algorithm;
    } else {
      validChecksumAlgorithms[i2++] = algorithm;
    }
  }
  return validChecksumAlgorithms.filter(Boolean);
}, "getChecksumAlgorithmListForResponse");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/isChecksumWithPartNumber.js
var isChecksumWithPartNumber = /* @__PURE__ */ __name((checksum) => {
  const lastHyphenIndex = checksum.lastIndexOf("-");
  if (lastHyphenIndex !== -1) {
    const numberPart = checksum.slice(lastHyphenIndex + 1);
    if (!numberPart.startsWith("0")) {
      const number = parseInt(numberPart, 10);
      if (!isNaN(number) && number >= 1 && number <= 1e4) {
        return true;
      }
    }
  }
  return false;
}, "isChecksumWithPartNumber");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/validateChecksumFromResponse.js
init_index_browser2();

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getChecksum.js
var getChecksum = /* @__PURE__ */ __name(async (body, { checksumAlgorithmFn, base64Encoder }) => base64Encoder(await stringHasher(checksumAlgorithmFn, body)), "getChecksum");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/validateChecksumFromResponse.js
var validateChecksumFromResponse = /* @__PURE__ */ __name(async (response, { config, responseAlgorithms, logger: logger2 }) => {
  const checksumAlgorithms = getChecksumAlgorithmListForResponse(responseAlgorithms);
  const { body: responseBody, headers: responseHeaders } = response;
  for (const algorithm of checksumAlgorithms) {
    const responseHeader = getChecksumLocationName(algorithm);
    const checksumFromResponse = responseHeaders[responseHeader];
    if (checksumFromResponse) {
      let checksumAlgorithmFn;
      try {
        checksumAlgorithmFn = selectChecksumAlgorithmFunction(algorithm, config);
      } catch (error) {
        if (algorithm === ChecksumAlgorithm.CRC64NVME) {
          logger2?.warn(`Skipping ${ChecksumAlgorithm.CRC64NVME} checksum validation: ${error.message}`);
          continue;
        }
        throw error;
      }
      const { base64Encoder } = config;
      if (isStreaming(responseBody)) {
        response.body = createChecksumStream({
          expectedChecksum: checksumFromResponse,
          checksumSourceLocation: responseHeader,
          checksum: new checksumAlgorithmFn(),
          source: responseBody,
          base64Encoder
        });
        return;
      }
      const checksum = await getChecksum(responseBody, { checksumAlgorithmFn, base64Encoder });
      if (checksum === checksumFromResponse) {
        break;
      }
      throw new Error(`Checksum mismatch: expected "${checksum}" but received "${checksumFromResponse}" in response header "${responseHeader}".`);
    }
  }
}, "validateChecksumFromResponse");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/flexibleChecksumsResponseMiddleware.js
var flexibleChecksumsResponseMiddlewareOptions = {
  name: "flexibleChecksumsResponseMiddleware",
  toMiddleware: "deserializerMiddleware",
  relation: "after",
  tags: ["BODY_CHECKSUM"],
  override: true
};
var flexibleChecksumsResponseMiddleware = /* @__PURE__ */ __name((config, middlewareConfig) => (next, context) => async (args) => {
  if (!HttpRequest.isInstance(args.request)) {
    return next(args);
  }
  const input = args.input;
  const result = await next(args);
  const response = result.response;
  const { requestValidationModeMember, responseAlgorithms } = middlewareConfig;
  if (requestValidationModeMember && input[requestValidationModeMember] === "ENABLED") {
    const { clientName, commandName } = context;
    const customChecksumAlgorithms = Object.keys(config.checksumAlgorithms ?? {}).filter((algorithm) => {
      const responseHeader = getChecksumLocationName(algorithm);
      return response.headers[responseHeader] !== void 0;
    });
    const algoList = getChecksumAlgorithmListForResponse([
      ...responseAlgorithms ?? [],
      ...customChecksumAlgorithms
    ]);
    const isS3WholeObjectMultipartGetResponseChecksum = clientName === "S3Client" && commandName === "GetObjectCommand" && algoList.every((algorithm) => {
      const responseHeader = getChecksumLocationName(algorithm);
      const checksumFromResponse = response.headers[responseHeader];
      return !checksumFromResponse || isChecksumWithPartNumber(checksumFromResponse);
    });
    if (isS3WholeObjectMultipartGetResponseChecksum) {
      return result;
    }
    await validateChecksumFromResponse(response, {
      config,
      responseAlgorithms: algoList,
      logger: context.logger
    });
  }
  return result;
}, "flexibleChecksumsResponseMiddleware");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/getFlexibleChecksumsPlugin.js
var getFlexibleChecksumsPlugin = /* @__PURE__ */ __name((config, middlewareConfig) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(flexibleChecksumsMiddleware(config, middlewareConfig), flexibleChecksumsMiddlewareOptions);
    clientStack.addRelativeTo(flexibleChecksumsInputMiddleware(config, middlewareConfig), flexibleChecksumsInputMiddlewareOptions);
    clientStack.addRelativeTo(flexibleChecksumsResponseMiddleware(config, middlewareConfig), flexibleChecksumsResponseMiddlewareOptions);
  }, "applyToStack")
}), "getFlexibleChecksumsPlugin");

// node_modules/@aws-sdk/middleware-flexible-checksums/dist-es/resolveFlexibleChecksumsConfig.js
init_client3();
var resolveFlexibleChecksumsConfig = /* @__PURE__ */ __name((input) => {
  const { requestChecksumCalculation, responseChecksumValidation, requestStreamBufferSize } = input;
  return Object.assign(input, {
    requestChecksumCalculation: normalizeProvider(requestChecksumCalculation ?? DEFAULT_REQUEST_CHECKSUM_CALCULATION),
    responseChecksumValidation: normalizeProvider(responseChecksumValidation ?? DEFAULT_RESPONSE_CHECKSUM_VALIDATION),
    requestStreamBufferSize: Number(requestStreamBufferSize ?? 0),
    checksumAlgorithms: input.checksumAlgorithms ?? {}
  });
}, "resolveFlexibleChecksumsConfig");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/check-content-length-header.js
init_client3();
init_protocols();
var CONTENT_LENGTH_HEADER2 = "content-length";
var DECODED_CONTENT_LENGTH_HEADER = "x-amz-decoded-content-length";
function checkContentLengthHeader() {
  return (next, context) => async (args) => {
    const { request } = args;
    if (HttpRequest.isInstance(request)) {
      if (!(CONTENT_LENGTH_HEADER2 in request.headers) && !(DECODED_CONTENT_LENGTH_HEADER in request.headers)) {
        const message = `Are you using a Stream of unknown length as the Body of a PutObject request? Consider using Upload instead from @aws-sdk/lib-storage.`;
        if (typeof context?.logger?.warn === "function" && !(context.logger instanceof NoOpLogger)) {
          context.logger.warn(message);
        } else {
          console.warn(message);
        }
      }
    }
    return next({ ...args });
  };
}
__name(checkContentLengthHeader, "checkContentLengthHeader");
var checkContentLengthHeaderMiddlewareOptions = {
  step: "finalizeRequest",
  tags: ["CHECK_CONTENT_LENGTH_HEADER"],
  name: "getCheckContentLengthHeaderPlugin",
  override: true
};
var getCheckContentLengthHeaderPlugin = /* @__PURE__ */ __name((unused) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(checkContentLengthHeader(), checkContentLengthHeaderMiddlewareOptions);
  }, "applyToStack")
}), "getCheckContentLengthHeaderPlugin");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/region-redirect-endpoint-middleware.js
var regionRedirectEndpointMiddleware = /* @__PURE__ */ __name((config) => {
  return (next, context) => async (args) => {
    const originalRegion = await config.region();
    const regionProviderRef = config.region;
    let unlock = /* @__PURE__ */ __name(() => {
    }, "unlock");
    if (context.__s3RegionRedirect) {
      Object.defineProperty(config, "region", {
        writable: false,
        value: /* @__PURE__ */ __name(async () => {
          return context.__s3RegionRedirect;
        }, "value")
      });
      unlock = /* @__PURE__ */ __name(() => Object.defineProperty(config, "region", {
        writable: true,
        value: regionProviderRef
      }), "unlock");
    }
    try {
      const result = await next(args);
      if (context.__s3RegionRedirect) {
        unlock();
        const region = await config.region();
        if (originalRegion !== region) {
          throw new Error("Region was not restored following S3 region redirect.");
        }
      }
      return result;
    } catch (e2) {
      unlock();
      throw e2;
    }
  };
}, "regionRedirectEndpointMiddleware");
var regionRedirectEndpointMiddlewareOptions = {
  tags: ["REGION_REDIRECT", "S3"],
  name: "regionRedirectEndpointMiddleware",
  override: true,
  relation: "before",
  toMiddleware: "endpointV2Middleware"
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/region-redirect-middleware.js
function regionRedirectMiddleware(clientConfig) {
  return (next, context) => async (args) => {
    try {
      return await next(args);
    } catch (err) {
      if (clientConfig.followRegionRedirects) {
        const statusCode = err?.$metadata?.httpStatusCode;
        const isHeadBucket = context.commandName === "HeadBucketCommand";
        const bucketRegionHeader = err?.$response?.headers?.["x-amz-bucket-region"];
        if (bucketRegionHeader) {
          if (statusCode === 301 || statusCode === 400 && (err?.name === "IllegalLocationConstraintException" || isHeadBucket)) {
            try {
              const actualRegion = bucketRegionHeader;
              context.logger?.debug(`Redirecting from ${await clientConfig.region()} to ${actualRegion}`);
              context.__s3RegionRedirect = actualRegion;
            } catch (e2) {
              throw new Error("Region redirect failed: " + e2);
            }
            return next(args);
          }
        }
      }
      throw err;
    }
  };
}
__name(regionRedirectMiddleware, "regionRedirectMiddleware");
var regionRedirectMiddlewareOptions = {
  step: "initialize",
  tags: ["REGION_REDIRECT", "S3"],
  name: "regionRedirectMiddleware",
  override: true
};
var getRegionRedirectMiddlewarePlugin = /* @__PURE__ */ __name((clientConfig) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(regionRedirectMiddleware(clientConfig), regionRedirectMiddlewareOptions);
    clientStack.addRelativeTo(regionRedirectEndpointMiddleware(clientConfig), regionRedirectEndpointMiddlewareOptions);
  }, "applyToStack")
}), "getRegionRedirectMiddlewarePlugin");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-expires-middleware.js
init_protocols();
init_index_browser2();
var s3ExpiresMiddleware = /* @__PURE__ */ __name((config) => {
  return (next, context) => async (args) => {
    const result = await next(args);
    const { response } = result;
    if (HttpResponse.isInstance(response)) {
      if (response.headers.expires) {
        response.headers.expiresstring = response.headers.expires;
        try {
          parseRfc7231DateTime(response.headers.expires);
        } catch (e2) {
          context.logger?.warn(`AWS SDK Warning for ${context.clientName}::${context.commandName} response parsing (${response.headers.expires}): ${e2}`);
          delete response.headers.expires;
        }
      }
    }
    return result;
  };
}, "s3ExpiresMiddleware");
var s3ExpiresMiddlewareOptions = {
  tags: ["S3"],
  name: "s3ExpiresMiddleware",
  override: true,
  relation: "after",
  toMiddleware: "deserializerMiddleware"
};
var getS3ExpiresMiddlewarePlugin = /* @__PURE__ */ __name((clientConfig) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.addRelativeTo(s3ExpiresMiddleware(clientConfig), s3ExpiresMiddlewareOptions);
  }, "applyToStack")
}), "getS3ExpiresMiddlewarePlugin");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/classes/S3ExpressIdentityCache.js
var S3ExpressIdentityCache = class _S3ExpressIdentityCache {
  static {
    __name(this, "S3ExpressIdentityCache");
  }
  data;
  lastPurgeTime = Date.now();
  static EXPIRED_CREDENTIAL_PURGE_INTERVAL_MS = 3e4;
  constructor(data = {}) {
    this.data = data;
  }
  get(key) {
    const entry = this.data[key];
    if (!entry) {
      return;
    }
    return entry;
  }
  set(key, entry) {
    this.data[key] = entry;
    return entry;
  }
  delete(key) {
    delete this.data[key];
  }
  async purgeExpired() {
    const now = Date.now();
    if (this.lastPurgeTime + _S3ExpressIdentityCache.EXPIRED_CREDENTIAL_PURGE_INTERVAL_MS > now) {
      return;
    }
    for (const key in this.data) {
      const entry = this.data[key];
      if (!entry.isRefreshing) {
        const credential = await entry.identity;
        if (credential.expiration) {
          if (credential.expiration.getTime() < now) {
            delete this.data[key];
          }
        }
      }
    }
  }
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/classes/S3ExpressIdentityCacheEntry.js
var S3ExpressIdentityCacheEntry = class {
  static {
    __name(this, "S3ExpressIdentityCacheEntry");
  }
  _identity;
  isRefreshing;
  accessed;
  constructor(_identity, isRefreshing = false, accessed = Date.now()) {
    this._identity = _identity;
    this.isRefreshing = isRefreshing;
    this.accessed = accessed;
  }
  get identity() {
    this.accessed = Date.now();
    return this._identity;
  }
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/classes/S3ExpressIdentityProviderImpl.js
var S3ExpressIdentityProviderImpl = class _S3ExpressIdentityProviderImpl {
  static {
    __name(this, "S3ExpressIdentityProviderImpl");
  }
  createSessionFn;
  cache;
  static REFRESH_WINDOW_MS = 6e4;
  constructor(createSessionFn, cache2 = new S3ExpressIdentityCache()) {
    this.createSessionFn = createSessionFn;
    this.cache = cache2;
  }
  async getS3ExpressIdentity(awsIdentity, identityProperties) {
    const key = identityProperties.Bucket;
    const { cache: cache2 } = this;
    const entry = cache2.get(key);
    if (entry) {
      return entry.identity.then((identity) => {
        const isExpired = (identity.expiration?.getTime() ?? 0) < Date.now();
        if (isExpired) {
          return cache2.set(key, new S3ExpressIdentityCacheEntry(this.getIdentity(key))).identity;
        }
        const isExpiringSoon = (identity.expiration?.getTime() ?? 0) < Date.now() + _S3ExpressIdentityProviderImpl.REFRESH_WINDOW_MS;
        if (isExpiringSoon && !entry.isRefreshing) {
          entry.isRefreshing = true;
          this.getIdentity(key).then((id) => {
            cache2.set(key, new S3ExpressIdentityCacheEntry(Promise.resolve(id)));
          });
        }
        return identity;
      });
    }
    return cache2.set(key, new S3ExpressIdentityCacheEntry(this.getIdentity(key))).identity;
  }
  async getIdentity(key) {
    await this.cache.purgeExpired().catch((error) => {
      console.warn("Error while clearing expired entries in S3ExpressIdentityCache: \n" + error);
    });
    const session = await this.createSessionFn(key);
    if (!session.Credentials?.AccessKeyId || !session.Credentials?.SecretAccessKey) {
      throw new Error("s3#createSession response credential missing AccessKeyId or SecretAccessKey.");
    }
    const identity = {
      accessKeyId: session.Credentials.AccessKeyId,
      secretAccessKey: session.Credentials.SecretAccessKey,
      sessionToken: session.Credentials.SessionToken,
      expiration: session.Credentials.Expiration ? new Date(session.Credentials.Expiration) : void 0
    };
    return identity;
  }
};

// node_modules/@smithy/signature-v4/dist-es/SignatureV4.js
init_index_browser2();

// node_modules/@smithy/signature-v4/dist-es/HeaderFormatter.js
init_index_browser2();
var HeaderFormatter = class {
  static {
    __name(this, "HeaderFormatter");
  }
  format(headers) {
    const chunks = [];
    for (const headerName of Object.keys(headers)) {
      const bytes = fromUtf8(headerName);
      chunks.push(Uint8Array.from([bytes.byteLength]), bytes, this.formatHeaderValue(headers[headerName]));
    }
    const out = new Uint8Array(chunks.reduce((carry, bytes) => carry + bytes.byteLength, 0));
    let position = 0;
    for (const chunk of chunks) {
      out.set(chunk, position);
      position += chunk.byteLength;
    }
    return out;
  }
  formatHeaderValue(header) {
    switch (header.type) {
      case "boolean":
        return Uint8Array.from([header.value ? 0 : 1]);
      case "byte":
        return Uint8Array.from([2, header.value]);
      case "short":
        const shortView = new DataView(new ArrayBuffer(3));
        shortView.setUint8(0, 3);
        shortView.setInt16(1, header.value, false);
        return new Uint8Array(shortView.buffer);
      case "integer":
        const intView = new DataView(new ArrayBuffer(5));
        intView.setUint8(0, 4);
        intView.setInt32(1, header.value, false);
        return new Uint8Array(intView.buffer);
      case "long":
        const longBytes = new Uint8Array(9);
        longBytes[0] = 5;
        longBytes.set(header.value.bytes, 1);
        return longBytes;
      case "binary":
        const binView = new DataView(new ArrayBuffer(3 + header.value.byteLength));
        binView.setUint8(0, 6);
        binView.setUint16(1, header.value.byteLength, false);
        const binBytes = new Uint8Array(binView.buffer);
        binBytes.set(header.value, 3);
        return binBytes;
      case "string":
        const utf8Bytes = fromUtf8(header.value);
        const strView = new DataView(new ArrayBuffer(3 + utf8Bytes.byteLength));
        strView.setUint8(0, 7);
        strView.setUint16(1, utf8Bytes.byteLength, false);
        const strBytes = new Uint8Array(strView.buffer);
        strBytes.set(utf8Bytes, 3);
        return strBytes;
      case "timestamp":
        const tsBytes = new Uint8Array(9);
        tsBytes[0] = 8;
        tsBytes.set(Int642.fromNumber(header.value.valueOf()).bytes, 1);
        return tsBytes;
      case "uuid":
        if (!UUID_PATTERN2.test(header.value)) {
          throw new Error(`Invalid UUID received: ${header.value}`);
        }
        const uuidBytes = new Uint8Array(17);
        uuidBytes[0] = 9;
        uuidBytes.set(fromHex(header.value.replace(/\-/g, "")), 1);
        return uuidBytes;
    }
  }
};
var HEADER_VALUE_TYPE2;
(function(HEADER_VALUE_TYPE3) {
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["boolTrue"] = 0] = "boolTrue";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["boolFalse"] = 1] = "boolFalse";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["byte"] = 2] = "byte";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["short"] = 3] = "short";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["integer"] = 4] = "integer";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["long"] = 5] = "long";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["byteArray"] = 6] = "byteArray";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["string"] = 7] = "string";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["timestamp"] = 8] = "timestamp";
  HEADER_VALUE_TYPE3[HEADER_VALUE_TYPE3["uuid"] = 9] = "uuid";
})(HEADER_VALUE_TYPE2 || (HEADER_VALUE_TYPE2 = {}));
var UUID_PATTERN2 = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
var Int642 = class _Int64 {
  static {
    __name(this, "Int64");
  }
  bytes;
  constructor(bytes) {
    this.bytes = bytes;
    if (bytes.byteLength !== 8) {
      throw new Error("Int64 buffers must be exactly 8 bytes");
    }
  }
  static fromNumber(number) {
    if (number > 9223372036854776e3 || number < -9223372036854776e3) {
      throw new Error(`${number} is too large (or, if negative, too small) to represent as an Int64`);
    }
    const bytes = new Uint8Array(8);
    for (let i2 = 7, remaining = Math.abs(Math.round(number)); i2 > -1 && remaining > 0; i2--, remaining /= 256) {
      bytes[i2] = remaining;
    }
    if (number < 0) {
      negate2(bytes);
    }
    return new _Int64(bytes);
  }
  valueOf() {
    const bytes = this.bytes.slice(0);
    const negative = bytes[0] & 128;
    if (negative) {
      negate2(bytes);
    }
    return parseInt(toHex(bytes), 16) * (negative ? -1 : 1);
  }
  toString() {
    return String(this.valueOf());
  }
};
function negate2(bytes) {
  for (let i2 = 0; i2 < 8; i2++) {
    bytes[i2] ^= 255;
  }
  for (let i2 = 7; i2 > -1; i2--) {
    bytes[i2]++;
    if (bytes[i2] !== 0)
      break;
  }
}
__name(negate2, "negate");

// node_modules/@smithy/signature-v4/dist-es/SignatureV4Base.js
init_client3();
init_protocols();
init_index_browser2();

// node_modules/@smithy/signature-v4/dist-es/getCanonicalQuery.js
init_protocols();

// node_modules/@smithy/signature-v4/dist-es/constants.js
var ALGORITHM_QUERY_PARAM = "X-Amz-Algorithm";
var CREDENTIAL_QUERY_PARAM = "X-Amz-Credential";
var AMZ_DATE_QUERY_PARAM = "X-Amz-Date";
var SIGNED_HEADERS_QUERY_PARAM = "X-Amz-SignedHeaders";
var EXPIRES_QUERY_PARAM = "X-Amz-Expires";
var SIGNATURE_QUERY_PARAM = "X-Amz-Signature";
var TOKEN_QUERY_PARAM = "X-Amz-Security-Token";
var AUTH_HEADER = "authorization";
var AMZ_DATE_HEADER = AMZ_DATE_QUERY_PARAM.toLowerCase();
var DATE_HEADER = "date";
var GENERATED_HEADERS = [AUTH_HEADER, AMZ_DATE_HEADER, DATE_HEADER];
var SIGNATURE_HEADER = SIGNATURE_QUERY_PARAM.toLowerCase();
var SHA256_HEADER = "x-amz-content-sha256";
var TOKEN_HEADER = TOKEN_QUERY_PARAM.toLowerCase();
var ALWAYS_UNSIGNABLE_HEADERS = {
  authorization: true,
  "cache-control": true,
  connection: true,
  expect: true,
  from: true,
  "keep-alive": true,
  "max-forwards": true,
  pragma: true,
  referer: true,
  te: true,
  trailer: true,
  "transfer-encoding": true,
  upgrade: true,
  "user-agent": true,
  "x-amzn-trace-id": true
};
var PROXY_HEADER_PATTERN = /^proxy-/;
var SEC_HEADER_PATTERN = /^sec-/;
var ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256";
var EVENT_ALGORITHM_IDENTIFIER = "AWS4-HMAC-SHA256-PAYLOAD";
var UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
var MAX_CACHE_SIZE = 50;
var KEY_TYPE_IDENTIFIER = "aws4_request";
var MAX_PRESIGNED_TTL = 60 * 60 * 24 * 7;

// node_modules/@smithy/signature-v4/dist-es/getCanonicalQuery.js
var getCanonicalQuery = /* @__PURE__ */ __name(({ query = {} }) => {
  const keys = [];
  const serialized = {};
  for (const key of Object.keys(query)) {
    if (key.toLowerCase() === SIGNATURE_HEADER) {
      continue;
    }
    const encodedKey = escapeUri(key);
    keys.push(encodedKey);
    const value = query[key];
    if (typeof value === "string") {
      serialized[encodedKey] = `${encodedKey}=${escapeUri(value)}`;
    } else if (Array.isArray(value)) {
      serialized[encodedKey] = value.slice(0).reduce((encoded, value2) => encoded.concat([`${encodedKey}=${escapeUri(value2)}`]), []).sort().join("&");
    }
  }
  return keys.sort().map((key) => serialized[key]).filter((serialized2) => serialized2).join("&");
}, "getCanonicalQuery");

// node_modules/@smithy/signature-v4/dist-es/utilDate.js
var iso8601 = /* @__PURE__ */ __name((time2) => toDate(time2).toISOString().replace(/\.\d{3}Z$/, "Z"), "iso8601");
var toDate = /* @__PURE__ */ __name((time2) => {
  if (typeof time2 === "number") {
    return new Date(time2 * 1e3);
  }
  if (typeof time2 === "string") {
    if (Number(time2)) {
      return new Date(Number(time2) * 1e3);
    }
    return new Date(time2);
  }
  return time2;
}, "toDate");

// node_modules/@smithy/signature-v4/dist-es/SignatureV4Base.js
var SignatureV4Base = class {
  static {
    __name(this, "SignatureV4Base");
  }
  service;
  regionProvider;
  credentialProvider;
  sha256;
  uriEscapePath;
  applyChecksum;
  constructor({ applyChecksum, credentials, region, service, sha256: sha2562, uriEscapePath = true }) {
    this.service = service;
    this.sha256 = sha2562;
    this.uriEscapePath = uriEscapePath;
    this.applyChecksum = typeof applyChecksum === "boolean" ? applyChecksum : true;
    this.regionProvider = normalizeProvider(region);
    this.credentialProvider = normalizeProvider(credentials);
  }
  createCanonicalRequest(request, canonicalHeaders, payloadHash) {
    const sortedHeaders = Object.keys(canonicalHeaders).sort();
    return `${request.method}
${this.getCanonicalPath(request)}
${getCanonicalQuery(request)}
${sortedHeaders.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n")}

${sortedHeaders.join(";")}
${payloadHash}`;
  }
  async createStringToSign(longDate, credentialScope, canonicalRequest, algorithmIdentifier) {
    const hash = new this.sha256();
    hash.update(toUint8Array(canonicalRequest));
    const hashedRequest = await hash.digest();
    return `${algorithmIdentifier}
${longDate}
${credentialScope}
${toHex(hashedRequest)}`;
  }
  getCanonicalPath({ path }) {
    if (this.uriEscapePath) {
      const normalizedPathSegments = [];
      for (const pathSegment of path.split("/")) {
        if (pathSegment?.length === 0)
          continue;
        if (pathSegment === ".")
          continue;
        if (pathSegment === "..") {
          normalizedPathSegments.pop();
        } else {
          normalizedPathSegments.push(pathSegment);
        }
      }
      const normalizedPath = `${path?.startsWith("/") ? "/" : ""}${normalizedPathSegments.join("/")}${normalizedPathSegments.length > 0 && path?.endsWith("/") ? "/" : ""}`;
      const doubleEncoded = escapeUri(normalizedPath);
      return doubleEncoded.replace(/%2F/g, "/");
    }
    return path;
  }
  validateResolvedCredentials(credentials) {
    if (typeof credentials !== "object" || typeof credentials.accessKeyId !== "string" || typeof credentials.secretAccessKey !== "string") {
      throw new Error("Resolved credential object is not valid");
    }
  }
  formatDate(now) {
    const longDate = iso8601(now).replace(/[\-:]/g, "");
    return {
      longDate,
      shortDate: longDate.slice(0, 8)
    };
  }
  getCanonicalHeaderList(headers) {
    return Object.keys(headers).sort().join(";");
  }
};

// node_modules/@smithy/signature-v4/dist-es/credentialDerivation.js
init_index_browser2();
var signingKeyCache = {};
var cacheQueue = [];
var createScope = /* @__PURE__ */ __name((shortDate, region, service) => `${shortDate}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`, "createScope");
var getSigningKey = /* @__PURE__ */ __name(async (sha256Constructor, credentials, shortDate, region, service) => {
  const credsHash = await hmac(sha256Constructor, credentials.secretAccessKey, credentials.accessKeyId);
  const cacheKey = `${shortDate}:${region}:${service}:${toHex(credsHash)}:${credentials.sessionToken}`;
  if (cacheKey in signingKeyCache) {
    return signingKeyCache[cacheKey];
  }
  cacheQueue.push(cacheKey);
  while (cacheQueue.length > MAX_CACHE_SIZE) {
    delete signingKeyCache[cacheQueue.shift()];
  }
  let key = `AWS4${credentials.secretAccessKey}`;
  for (const signable of [shortDate, region, service, KEY_TYPE_IDENTIFIER]) {
    key = await hmac(sha256Constructor, key, signable);
  }
  return signingKeyCache[cacheKey] = key;
}, "getSigningKey");
var hmac = /* @__PURE__ */ __name((ctor, secret, data) => {
  const hash = new ctor(secret);
  hash.update(toUint8Array(data));
  return hash.digest();
}, "hmac");

// node_modules/@smithy/signature-v4/dist-es/getCanonicalHeaders.js
var getCanonicalHeaders = /* @__PURE__ */ __name(({ headers }, unsignableHeaders, signableHeaders) => {
  const canonical = {};
  for (const headerName of Object.keys(headers).sort()) {
    if (headers[headerName] == void 0) {
      continue;
    }
    const canonicalHeaderName = headerName.toLowerCase();
    if (canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS || unsignableHeaders?.has(canonicalHeaderName) || PROXY_HEADER_PATTERN.test(canonicalHeaderName) || SEC_HEADER_PATTERN.test(canonicalHeaderName)) {
      if (!signableHeaders || signableHeaders && !signableHeaders.has(canonicalHeaderName)) {
        continue;
      }
    }
    canonical[canonicalHeaderName] = headers[headerName].trim().replace(/\s+/g, " ");
  }
  return canonical;
}, "getCanonicalHeaders");

// node_modules/@smithy/signature-v4/dist-es/getPayloadHash.js
init_index_browser2();
var getPayloadHash = /* @__PURE__ */ __name(async ({ headers, body }, hashConstructor) => {
  for (const headerName of Object.keys(headers)) {
    if (headerName.toLowerCase() === SHA256_HEADER) {
      return headers[headerName];
    }
  }
  if (body == void 0) {
    return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  } else if (typeof body === "string" || ArrayBuffer.isView(body) || isArrayBuffer(body)) {
    const hashCtor = new hashConstructor();
    hashCtor.update(toUint8Array(body));
    return toHex(await hashCtor.digest());
  }
  return UNSIGNED_PAYLOAD;
}, "getPayloadHash");

// node_modules/@smithy/signature-v4/dist-es/headerUtil.js
var hasHeader2 = /* @__PURE__ */ __name((soughtHeader, headers) => {
  soughtHeader = soughtHeader.toLowerCase();
  for (const headerName of Object.keys(headers)) {
    if (soughtHeader === headerName.toLowerCase()) {
      return true;
    }
  }
  return false;
}, "hasHeader");

// node_modules/@smithy/signature-v4/dist-es/moveHeadersToQuery.js
init_protocols();
var moveHeadersToQuery = /* @__PURE__ */ __name((request, options = {}) => {
  const { headers, query = {} } = HttpRequest.clone(request);
  for (const name of Object.keys(headers)) {
    const lname = name.toLowerCase();
    if (lname.slice(0, 6) === "x-amz-" && !options.unhoistableHeaders?.has(lname) || options.hoistableHeaders?.has(lname)) {
      query[name] = headers[name];
      delete headers[name];
    }
  }
  return {
    ...request,
    headers,
    query
  };
}, "moveHeadersToQuery");

// node_modules/@smithy/signature-v4/dist-es/prepareRequest.js
init_protocols();
var prepareRequest = /* @__PURE__ */ __name((request) => {
  request = HttpRequest.clone(request);
  for (const headerName of Object.keys(request.headers)) {
    if (GENERATED_HEADERS.indexOf(headerName.toLowerCase()) > -1) {
      delete request.headers[headerName];
    }
  }
  return request;
}, "prepareRequest");

// node_modules/@smithy/signature-v4/dist-es/SignatureV4.js
var SignatureV4 = class extends SignatureV4Base {
  static {
    __name(this, "SignatureV4");
  }
  headerFormatter = new HeaderFormatter();
  constructor({ applyChecksum, credentials, region, service, sha256: sha2562, uriEscapePath = true }) {
    super({
      applyChecksum,
      credentials,
      region,
      service,
      sha256: sha2562,
      uriEscapePath
    });
  }
  async presign(originalRequest, options = {}) {
    const { signingDate = /* @__PURE__ */ new Date(), expiresIn = 3600, unsignableHeaders, unhoistableHeaders, signableHeaders, hoistableHeaders, signingRegion, signingService } = options;
    const credentials = await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? await this.regionProvider();
    const { longDate, shortDate } = this.formatDate(signingDate);
    if (expiresIn > MAX_PRESIGNED_TTL) {
      return Promise.reject("Signature version 4 presigned URLs must have an expiration date less than one week in the future");
    }
    const scope = createScope(shortDate, region, signingService ?? this.service);
    const request = moveHeadersToQuery(prepareRequest(originalRequest), { unhoistableHeaders, hoistableHeaders });
    if (credentials.sessionToken) {
      request.query[TOKEN_QUERY_PARAM] = credentials.sessionToken;
    }
    request.query[ALGORITHM_QUERY_PARAM] = ALGORITHM_IDENTIFIER;
    request.query[CREDENTIAL_QUERY_PARAM] = `${credentials.accessKeyId}/${scope}`;
    request.query[AMZ_DATE_QUERY_PARAM] = longDate;
    request.query[EXPIRES_QUERY_PARAM] = expiresIn.toString(10);
    const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
    request.query[SIGNED_HEADERS_QUERY_PARAM] = this.getCanonicalHeaderList(canonicalHeaders);
    request.query[SIGNATURE_QUERY_PARAM] = await this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, await getPayloadHash(originalRequest, this.sha256)));
    return request;
  }
  async sign(toSign, options) {
    if (typeof toSign === "string") {
      return this.signString(toSign, options);
    } else if (toSign.headers && toSign.payload) {
      return this.signEvent(toSign, options);
    } else if (toSign.message) {
      return this.signMessage(toSign, options);
    } else {
      return this.signRequest(toSign, options);
    }
  }
  async signEvent({ headers, payload }, { signingDate = /* @__PURE__ */ new Date(), priorSignature, signingRegion, signingService, eventStreamCredentials }) {
    const region = signingRegion ?? await this.regionProvider();
    const { shortDate, longDate } = this.formatDate(signingDate);
    const scope = createScope(shortDate, region, signingService ?? this.service);
    const hashedPayload = await getPayloadHash({ headers: {}, body: payload }, this.sha256);
    const hash = new this.sha256();
    hash.update(headers);
    const hashedHeaders = toHex(await hash.digest());
    const stringToSign = [
      EVENT_ALGORITHM_IDENTIFIER,
      longDate,
      scope,
      priorSignature,
      hashedHeaders,
      hashedPayload
    ].join("\n");
    return this.signString(stringToSign, {
      signingDate,
      signingRegion: region,
      signingService,
      eventStreamCredentials
    });
  }
  async signMessage(signableMessage, { signingDate = /* @__PURE__ */ new Date(), signingRegion, signingService, eventStreamCredentials }) {
    const promise = this.signEvent({
      headers: this.headerFormatter.format(signableMessage.message.headers),
      payload: signableMessage.message.body
    }, {
      signingDate,
      signingRegion,
      signingService,
      priorSignature: signableMessage.priorSignature,
      eventStreamCredentials
    });
    return promise.then((signature) => {
      return { message: signableMessage.message, signature };
    });
  }
  async signString(stringToSign, { signingDate = /* @__PURE__ */ new Date(), signingRegion, signingService, eventStreamCredentials } = {}) {
    const credentials = eventStreamCredentials ?? await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? await this.regionProvider();
    const { shortDate } = this.formatDate(signingDate);
    const hash = new this.sha256(await this.getSigningKey(credentials, region, shortDate, signingService));
    hash.update(toUint8Array(stringToSign));
    return toHex(await hash.digest());
  }
  async signRequest(requestToSign, { signingDate = /* @__PURE__ */ new Date(), signableHeaders, unsignableHeaders, signingRegion, signingService } = {}) {
    const credentials = await this.credentialProvider();
    this.validateResolvedCredentials(credentials);
    const region = signingRegion ?? await this.regionProvider();
    const request = prepareRequest(requestToSign);
    const { longDate, shortDate } = this.formatDate(signingDate);
    const scope = createScope(shortDate, region, signingService ?? this.service);
    request.headers[AMZ_DATE_HEADER] = longDate;
    if (credentials.sessionToken) {
      request.headers[TOKEN_HEADER] = credentials.sessionToken;
    }
    const payloadHash = await getPayloadHash(request, this.sha256);
    if (!hasHeader2(SHA256_HEADER, request.headers) && this.applyChecksum) {
      request.headers[SHA256_HEADER] = payloadHash;
    }
    const canonicalHeaders = getCanonicalHeaders(request, unsignableHeaders, signableHeaders);
    const signature = await this.getSignature(longDate, scope, this.getSigningKey(credentials, region, shortDate, signingService), this.createCanonicalRequest(request, canonicalHeaders, payloadHash));
    request.headers[AUTH_HEADER] = `${ALGORITHM_IDENTIFIER} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${this.getCanonicalHeaderList(canonicalHeaders)}, Signature=${signature}`;
    return request;
  }
  async getSignature(longDate, credentialScope, keyPromise, canonicalRequest) {
    const stringToSign = await this.createStringToSign(longDate, credentialScope, canonicalRequest, ALGORITHM_IDENTIFIER);
    const hash = new this.sha256(await keyPromise);
    hash.update(toUint8Array(stringToSign));
    return toHex(await hash.digest());
  }
  getSigningKey(credentials, region, shortDate, service) {
    return getSigningKey(this.sha256, credentials, shortDate, region, service || this.service);
  }
};

// node_modules/@smithy/signature-v4/dist-es/signature-v4a-container.js
var signatureV4aContainer = {
  SignatureV4a: null
};

// node_modules/@aws-sdk/signature-v4-multi-region/dist-es/signature-v4-crt-container.js
var signatureV4CrtContainer = {
  CrtSignerV4: null
};

// node_modules/@aws-sdk/signature-v4-multi-region/dist-es/SignatureV4SignWithCredentials.js
var SESSION_TOKEN_QUERY_PARAM = "X-Amz-S3session-Token";
var SESSION_TOKEN_HEADER = SESSION_TOKEN_QUERY_PARAM.toLowerCase();
var SignatureV4SignWithCredentials = class extends SignatureV4 {
  static {
    __name(this, "SignatureV4SignWithCredentials");
  }
  async signWithCredentials(requestToSign, credentials, options) {
    const credentialsWithoutSessionToken = getCredentialsWithoutSessionToken(credentials);
    requestToSign.headers[SESSION_TOKEN_HEADER] = credentials.sessionToken;
    const privateAccess = this;
    setSingleOverride(privateAccess, credentialsWithoutSessionToken);
    return privateAccess.signRequest(requestToSign, options ?? {});
  }
  async presignWithCredentials(requestToSign, credentials, options) {
    const credentialsWithoutSessionToken = getCredentialsWithoutSessionToken(credentials);
    delete requestToSign.headers[SESSION_TOKEN_HEADER];
    requestToSign.headers[SESSION_TOKEN_QUERY_PARAM] = credentials.sessionToken;
    requestToSign.query = requestToSign.query ?? {};
    requestToSign.query[SESSION_TOKEN_QUERY_PARAM] = credentials.sessionToken;
    const privateAccess = this;
    setSingleOverride(privateAccess, credentialsWithoutSessionToken);
    return this.presign(requestToSign, options);
  }
};
function getCredentialsWithoutSessionToken(credentials) {
  return {
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    expiration: credentials.expiration
  };
}
__name(getCredentialsWithoutSessionToken, "getCredentialsWithoutSessionToken");
function setSingleOverride(privateAccess, credentialsWithoutSessionToken) {
  const currentCredentialProvider = privateAccess.credentialProvider;
  privateAccess.credentialProvider = () => {
    privateAccess.credentialProvider = currentCredentialProvider;
    return Promise.resolve(credentialsWithoutSessionToken);
  };
}
__name(setSingleOverride, "setSingleOverride");

// node_modules/@aws-sdk/signature-v4-multi-region/dist-es/SignatureV4MultiRegion.js
var SignatureV4MultiRegion = class {
  static {
    __name(this, "SignatureV4MultiRegion");
  }
  sigv4aSigner;
  sigv4Signer;
  signerOptions;
  static sigv4aDependency() {
    if (typeof signatureV4CrtContainer.CrtSignerV4 === "function") {
      return "crt";
    } else if (typeof signatureV4aContainer.SignatureV4a === "function") {
      return "js";
    }
    return "none";
  }
  constructor(options) {
    this.sigv4Signer = new SignatureV4SignWithCredentials(options);
    this.signerOptions = options;
  }
  async sign(requestToSign, options = {}) {
    if (options.signingRegion === "*") {
      return this.getSigv4aSigner().sign(requestToSign, options);
    }
    return this.sigv4Signer.sign(requestToSign, options);
  }
  async signWithCredentials(requestToSign, credentials, options = {}) {
    if (options.signingRegion === "*") {
      const signer = this.getSigv4aSigner();
      const CrtSignerV4 = signatureV4CrtContainer.CrtSignerV4;
      if (CrtSignerV4 && signer instanceof CrtSignerV4) {
        return signer.signWithCredentials(requestToSign, credentials, options);
      } else {
        throw new Error(`signWithCredentials with signingRegion '*' is only supported when using the CRT dependency @aws-sdk/signature-v4-crt. Please check whether you have installed the "@aws-sdk/signature-v4-crt" package explicitly. You must also register the package by calling [require("@aws-sdk/signature-v4-crt");] or an ESM equivalent such as [import "@aws-sdk/signature-v4-crt";]. For more information please go to https://github.com/aws/aws-sdk-js-v3#functionality-requiring-aws-common-runtime-crt`);
      }
    }
    return this.sigv4Signer.signWithCredentials(requestToSign, credentials, options);
  }
  async presign(originalRequest, options = {}) {
    if (options.signingRegion === "*") {
      const signer = this.getSigv4aSigner();
      const CrtSignerV4 = signatureV4CrtContainer.CrtSignerV4;
      if (CrtSignerV4 && signer instanceof CrtSignerV4) {
        return signer.presign(originalRequest, options);
      } else {
        throw new Error(`presign with signingRegion '*' is only supported when using the CRT dependency @aws-sdk/signature-v4-crt. Please check whether you have installed the "@aws-sdk/signature-v4-crt" package explicitly. You must also register the package by calling [require("@aws-sdk/signature-v4-crt");] or an ESM equivalent such as [import "@aws-sdk/signature-v4-crt";]. For more information please go to https://github.com/aws/aws-sdk-js-v3#functionality-requiring-aws-common-runtime-crt`);
      }
    }
    return this.sigv4Signer.presign(originalRequest, options);
  }
  async presignWithCredentials(originalRequest, credentials, options = {}) {
    if (options.signingRegion === "*") {
      throw new Error("Method presignWithCredentials is not supported for [signingRegion=*].");
    }
    return this.sigv4Signer.presignWithCredentials(originalRequest, credentials, options);
  }
  getSigv4aSigner() {
    if (!this.sigv4aSigner) {
      const CrtSignerV4 = signatureV4CrtContainer.CrtSignerV4;
      const JsSigV4aSigner = signatureV4aContainer.SignatureV4a;
      if (this.signerOptions.runtime === "node") {
        if (!CrtSignerV4 && !JsSigV4aSigner) {
          throw new Error("Neither CRT nor JS SigV4a implementation is available. Please load either @aws-sdk/signature-v4-crt or @aws-sdk/signature-v4a. For more information please go to https://github.com/aws/aws-sdk-js-v3#functionality-requiring-aws-common-runtime-crt");
        }
        if (CrtSignerV4 && typeof CrtSignerV4 === "function") {
          this.sigv4aSigner = new CrtSignerV4({
            ...this.signerOptions,
            signingAlgorithm: 1
          });
        } else if (JsSigV4aSigner && typeof JsSigV4aSigner === "function") {
          this.sigv4aSigner = new JsSigV4aSigner({
            ...this.signerOptions
          });
        } else {
          throw new Error("Available SigV4a implementation is not a valid constructor. Please ensure you've properly imported @aws-sdk/signature-v4-crt or @aws-sdk/signature-v4a.For more information please go to https://github.com/aws/aws-sdk-js-v3#functionality-requiring-aws-common-runtime-crt");
        }
      } else {
        if (!JsSigV4aSigner || typeof JsSigV4aSigner !== "function") {
          throw new Error("JS SigV4a implementation is not available or not a valid constructor. Please check whether you have installed the @aws-sdk/signature-v4a package explicitly. The CRT implementation is not available for browsers. You must also register the package by calling [require('@aws-sdk/signature-v4a');] or an ESM equivalent such as [import '@aws-sdk/signature-v4a';]. For more information please go to https://github.com/aws/aws-sdk-js-v3#using-javascript-non-crt-implementation-of-sigv4a");
        }
        this.sigv4aSigner = new JsSigV4aSigner({
          ...this.signerOptions
        });
      }
    }
    return this.sigv4aSigner;
  }
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/constants.js
var S3_EXPRESS_BUCKET_TYPE = "Directory";
var S3_EXPRESS_BACKEND = "S3Express";
var S3_EXPRESS_AUTH_SCHEME = "sigv4-s3express";
var SESSION_TOKEN_QUERY_PARAM2 = "X-Amz-S3session-Token";
var SESSION_TOKEN_HEADER2 = SESSION_TOKEN_QUERY_PARAM2.toLowerCase();

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/functions/s3ExpressMiddleware.js
init_protocols();
var s3ExpressMiddleware = /* @__PURE__ */ __name((options) => {
  return (next, context) => async (args) => {
    if (context.endpointV2) {
      const endpoint = context.endpointV2;
      const isS3ExpressAuth = endpoint.properties?.authSchemes?.[0]?.name === S3_EXPRESS_AUTH_SCHEME;
      const isS3ExpressBucket = endpoint.properties?.backend === S3_EXPRESS_BACKEND || endpoint.properties?.bucketType === S3_EXPRESS_BUCKET_TYPE;
      if (isS3ExpressBucket) {
        setFeature2(context, "S3_EXPRESS_BUCKET", "J");
        context.isS3ExpressBucket = true;
      }
      if (isS3ExpressAuth) {
        const requestBucket = args.input.Bucket;
        if (requestBucket) {
          const s3ExpressIdentity = await options.s3ExpressIdentityProvider.getS3ExpressIdentity(await options.credentials(), {
            Bucket: requestBucket
          });
          context.s3ExpressIdentity = s3ExpressIdentity;
          if (HttpRequest.isInstance(args.request) && s3ExpressIdentity.sessionToken) {
            args.request.headers[SESSION_TOKEN_HEADER2] = s3ExpressIdentity.sessionToken;
          }
        }
      }
    }
    return next(args);
  };
}, "s3ExpressMiddleware");
var s3ExpressMiddlewareOptions = {
  name: "s3ExpressMiddleware",
  step: "build",
  tags: ["S3", "S3_EXPRESS"],
  override: true
};
var getS3ExpressPlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(s3ExpressMiddleware(options), s3ExpressMiddlewareOptions);
  }, "applyToStack")
}), "getS3ExpressPlugin");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/functions/s3ExpressHttpSigningMiddleware.js
init_client3();
init_protocols();

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/functions/signS3Express.js
var signS3Express = /* @__PURE__ */ __name(async (s3ExpressIdentity, signingOptions, request, sigV4MultiRegionSigner) => {
  const signedRequest = await sigV4MultiRegionSigner.signWithCredentials(request, s3ExpressIdentity, {});
  if (signedRequest.headers["X-Amz-Security-Token"] || signedRequest.headers["x-amz-security-token"]) {
    throw new Error("X-Amz-Security-Token must not be set for s3-express requests.");
  }
  return signedRequest;
}, "signS3Express");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3-express/functions/s3ExpressHttpSigningMiddleware.js
var defaultErrorHandler2 = /* @__PURE__ */ __name((signingProperties) => (error) => {
  throw error;
}, "defaultErrorHandler");
var defaultSuccessHandler2 = /* @__PURE__ */ __name((httpResponse, signingProperties) => {
}, "defaultSuccessHandler");
var s3ExpressHttpSigningMiddleware = /* @__PURE__ */ __name((config) => (next, context) => async (args) => {
  if (!HttpRequest.isInstance(args.request)) {
    return next(args);
  }
  const smithyContext = getSmithyContext(context);
  const scheme = smithyContext.selectedHttpAuthScheme;
  if (!scheme) {
    throw new Error(`No HttpAuthScheme was selected: unable to sign request`);
  }
  const { httpAuthOption: { signingProperties = {} }, identity, signer } = scheme;
  let request;
  if (context.s3ExpressIdentity) {
    request = await signS3Express(context.s3ExpressIdentity, signingProperties, args.request, await config.signer());
  } else {
    request = await signer.sign(args.request, identity, signingProperties);
  }
  const output = await next({
    ...args,
    request
  }).catch((signer.errorHandler || defaultErrorHandler2)(signingProperties));
  (signer.successHandler || defaultSuccessHandler2)(output.response, signingProperties);
  return output;
}, "s3ExpressHttpSigningMiddleware");
var getS3ExpressHttpSigningPlugin = /* @__PURE__ */ __name((config) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.addRelativeTo(s3ExpressHttpSigningMiddleware(config), httpSigningMiddlewareOptions);
  }, "applyToStack")
}), "getS3ExpressHttpSigningPlugin");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/s3Configuration.js
var resolveS3Config = /* @__PURE__ */ __name((input, { session }) => {
  const [s3ClientProvider, CreateSessionCommandCtor] = session;
  const { forcePathStyle, useAccelerateEndpoint, disableMultiregionAccessPoints, followRegionRedirects, s3ExpressIdentityProvider, bucketEndpoint, expectContinueHeader } = input;
  return Object.assign(input, {
    forcePathStyle: forcePathStyle ?? false,
    useAccelerateEndpoint: useAccelerateEndpoint ?? false,
    disableMultiregionAccessPoints: disableMultiregionAccessPoints ?? false,
    followRegionRedirects: followRegionRedirects ?? false,
    s3ExpressIdentityProvider: s3ExpressIdentityProvider ?? new S3ExpressIdentityProviderImpl(async (key) => s3ClientProvider().send(new CreateSessionCommandCtor({
      Bucket: key
    }))),
    bucketEndpoint: bucketEndpoint ?? false,
    expectContinueHeader: expectContinueHeader ?? 2097152
  });
}, "resolveS3Config");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/throw-200-exceptions.js
init_protocols();

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/toStream.browser.js
function toStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}
__name(toStream, "toStream");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/throw-200-exceptions.js
var THROW_IF_EMPTY_BODY = {
  CopyObjectCommand: true,
  UploadPartCopyCommand: true,
  CompleteMultipartUploadCommand: true
};
var throw200ExceptionsMiddleware = /* @__PURE__ */ __name((config) => (next, context) => async (args) => {
  const result = await next(args);
  const { response } = result;
  if (!HttpResponse.isInstance(response)) {
    return result;
  }
  const { statusCode, body } = response;
  if (statusCode < 200 || statusCode >= 300) {
    return result;
  }
  const bodyBytes = await collectBody2(body, config);
  response.body = toStream(bodyBytes);
  if (bodyBytes.length === 0 && THROW_IF_EMPTY_BODY[context.commandName]) {
    const err = new Error("S3 aborted request");
    err.$metadata = {
      httpStatusCode: 503
    };
    err.name = "InternalError";
    throw err;
  }
  const bodyStringTail = config.utf8Encoder(bodyBytes.subarray(bodyBytes.length - 16));
  if (bodyStringTail && bodyStringTail.endsWith("</Error>")) {
    response.statusCode = 503;
  }
  return result;
}, "throw200ExceptionsMiddleware");
var collectBody2 = /* @__PURE__ */ __name((streamBody = new Uint8Array(), context) => {
  if (streamBody instanceof Uint8Array) {
    return Promise.resolve(streamBody);
  }
  return context.streamCollector(streamBody) || Promise.resolve(new Uint8Array());
}, "collectBody");
var throw200ExceptionsMiddlewareOptions = {
  relation: "after",
  toMiddleware: "deserializerMiddleware",
  tags: ["THROW_200_EXCEPTIONS", "S3"],
  name: "throw200ExceptionsMiddleware",
  override: true
};
var getThrow200ExceptionsPlugin = /* @__PURE__ */ __name((config) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.addRelativeTo(throw200ExceptionsMiddleware(config), throw200ExceptionsMiddlewareOptions);
  }, "applyToStack")
}), "getThrow200ExceptionsPlugin");

// node_modules/@aws-sdk/core/dist-es/submodules/util/util-arn-parser/arn.js
var validate = /* @__PURE__ */ __name((str) => typeof str === "string" && str.indexOf("arn:") === 0 && str.split(":").length >= 6, "validate");

// node_modules/@aws-sdk/core/dist-es/submodules/util/util-format-url/format-url.js
init_protocols();
function formatUrl(request) {
  const { port, query } = request;
  let { protocol, path, hostname } = request;
  if (protocol && protocol.slice(-1) !== ":") {
    protocol += ":";
  }
  if (port) {
    hostname += `:${port}`;
  }
  if (path && path.charAt(0) !== "/") {
    path = `/${path}`;
  }
  let queryString = query ? buildQueryString(query) : "";
  if (queryString && queryString[0] !== "?") {
    queryString = `?${queryString}`;
  }
  let auth2 = "";
  if (request.username != null || request.password != null) {
    const username = request.username ?? "";
    const password = request.password ?? "";
    auth2 = `${username}:${password}@`;
  }
  let fragment = "";
  if (request.fragment) {
    fragment = `#${request.fragment}`;
  }
  return `${protocol}//${auth2}${hostname}${path}${queryString}${fragment}`;
}
__name(formatUrl, "formatUrl");

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/bucket-endpoint-middleware.js
function bucketEndpointMiddleware(options) {
  return (next, context) => async (args) => {
    if (options.bucketEndpoint) {
      const endpoint = context.endpointV2;
      if (endpoint) {
        const bucket = args.input.Bucket;
        if (typeof bucket === "string") {
          try {
            const bucketEndpointUrl = new URL(bucket);
            context.endpointV2 = {
              ...endpoint,
              url: bucketEndpointUrl
            };
          } catch (e2) {
            const warning = `@aws-sdk/middleware-sdk-s3: bucketEndpoint=true was set but Bucket=${bucket} could not be parsed as URL.`;
            if (context.logger?.constructor?.name === "NoOpLogger") {
              console.warn(warning);
            } else {
              context.logger?.warn?.(warning);
            }
            throw e2;
          }
        }
      }
    }
    return next(args);
  };
}
__name(bucketEndpointMiddleware, "bucketEndpointMiddleware");
var bucketEndpointMiddlewareOptions = {
  name: "bucketEndpointMiddleware",
  override: true,
  relation: "after",
  toMiddleware: "endpointV2Middleware"
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/validate-bucket-name.js
function validateBucketNameMiddleware({ bucketEndpoint }) {
  return (next) => async (args) => {
    const { input: { Bucket } } = args;
    if (!bucketEndpoint && typeof Bucket === "string" && !validate(Bucket) && Bucket.indexOf("/") >= 0) {
      const err = new Error(`Bucket name shouldn't contain '/', received '${Bucket}'`);
      err.name = "InvalidBucketName";
      throw err;
    }
    return next({ ...args });
  };
}
__name(validateBucketNameMiddleware, "validateBucketNameMiddleware");
var validateBucketNameMiddlewareOptions = {
  step: "initialize",
  tags: ["VALIDATE_BUCKET_NAME"],
  name: "validateBucketNameMiddleware",
  override: true
};
var getValidateBucketNamePlugin = /* @__PURE__ */ __name((options) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(validateBucketNameMiddleware(options), validateBucketNameMiddlewareOptions);
    clientStack.addRelativeTo(bucketEndpointMiddleware(options), bucketEndpointMiddlewareOptions);
  }, "applyToStack")
}), "getValidateBucketNamePlugin");

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/ProtocolLib.js
init_client3();
init_schema2();
var ProtocolLib = class {
  static {
    __name(this, "ProtocolLib");
  }
  queryCompat;
  errorRegistry;
  constructor(queryCompat = false) {
    this.queryCompat = queryCompat;
  }
  resolveRestContentType(defaultContentType, inputSchema) {
    const members = inputSchema.getMemberSchemas();
    const httpPayloadMember = Object.values(members).find((m2) => {
      return !!m2.getMergedTraits().httpPayload;
    });
    if (httpPayloadMember) {
      const mediaType = httpPayloadMember.getMergedTraits().mediaType;
      if (mediaType) {
        return mediaType;
      } else if (httpPayloadMember.isStringSchema()) {
        return "text/plain";
      } else if (httpPayloadMember.isBlobSchema()) {
        return "application/octet-stream";
      } else {
        return defaultContentType;
      }
    } else if (!inputSchema.isUnitSchema()) {
      const hasBody = Object.values(members).find((m2) => {
        const { httpQuery, httpQueryParams, httpHeader, httpLabel, httpPrefixHeaders } = m2.getMergedTraits();
        const noPrefixHeaders = httpPrefixHeaders === void 0;
        return !httpQuery && !httpQueryParams && !httpHeader && !httpLabel && noPrefixHeaders;
      });
      if (hasBody) {
        return defaultContentType;
      }
    }
  }
  async getErrorSchemaOrThrowBaseException(errorIdentifier, defaultNamespace, response, dataObject, metadata, getErrorSchema) {
    let errorName = errorIdentifier;
    if (errorIdentifier.includes("#")) {
      [, errorName] = errorIdentifier.split("#");
    }
    const errorMetadata = {
      $metadata: metadata,
      $fault: response.statusCode < 500 ? "client" : "server"
    };
    if (!this.errorRegistry) {
      throw new Error("@aws-sdk/core/protocols - error handler not initialized.");
    }
    try {
      const errorSchema = getErrorSchema?.(this.errorRegistry, errorName) ?? this.errorRegistry.getSchema(errorIdentifier);
      return { errorSchema, errorMetadata };
    } catch (e2) {
      dataObject.message = dataObject.message ?? dataObject.Message ?? "UnknownError";
      const synthetic = this.errorRegistry;
      const baseExceptionSchema = synthetic.getBaseException();
      if (baseExceptionSchema) {
        const ErrorCtor = synthetic.getErrorCtor(baseExceptionSchema) ?? Error;
        throw this.decorateServiceException(Object.assign(new ErrorCtor({ name: errorName }), errorMetadata), dataObject);
      }
      const d2 = dataObject;
      const message = d2?.message ?? d2?.Message ?? d2?.Error?.Message ?? d2?.Error?.message;
      throw this.decorateServiceException(Object.assign(new Error(message), {
        name: errorName
      }, errorMetadata), dataObject);
    }
  }
  compose(composite, errorIdentifier, defaultNamespace) {
    let namespace = defaultNamespace;
    if (errorIdentifier.includes("#")) {
      [namespace] = errorIdentifier.split("#");
    }
    const staticRegistry = TypeRegistry.for(namespace);
    const defaultSyntheticRegistry = TypeRegistry.for("smithy.ts.sdk.synthetic." + defaultNamespace);
    composite.copyFrom(staticRegistry);
    composite.copyFrom(defaultSyntheticRegistry);
    this.errorRegistry = composite;
  }
  decorateServiceException(exception, additions = {}) {
    if (this.queryCompat) {
      const msg = exception.Message ?? additions.Message;
      const error = decorateServiceException(exception, additions);
      if (msg) {
        error.message = msg;
      }
      const errorObj = error.Error ?? {};
      errorObj.Type = error.Error?.Type;
      errorObj.Code = error.Error?.Code;
      errorObj.Message = error.Error?.message ?? error.Error?.Message ?? msg;
      error.Error = errorObj;
      const reqId = error.$metadata.requestId;
      if (reqId) {
        error.RequestId = reqId;
      }
      return error;
    }
    return decorateServiceException(exception, additions);
  }
  setQueryCompatError(output, response) {
    const queryErrorHeader = response.headers?.["x-amzn-query-error"];
    if (output !== void 0 && queryErrorHeader != null) {
      const [Code, Type] = queryErrorHeader.split(";");
      const keys = Object.keys(output);
      const Error2 = {
        Code,
        Type
      };
      output.Code = Code;
      output.Type = Type;
      for (let i2 = 0; i2 < keys.length; i2++) {
        const k2 = keys[i2];
        Error2[k2 === "message" ? "Message" : k2] = output[k2];
      }
      delete Error2.__type;
      output.Error = Error2;
    }
  }
  queryCompatOutput(queryCompatErrorData, errorData) {
    if (queryCompatErrorData.Error) {
      errorData.Error = queryCompatErrorData.Error;
    }
    if (queryCompatErrorData.Type) {
      errorData.Type = queryCompatErrorData.Type;
    }
    if (queryCompatErrorData.Code) {
      errorData.Code = queryCompatErrorData.Code;
    }
  }
  findQueryCompatibleError(registry, errorName) {
    try {
      return registry.getSchema(errorName);
    } catch (e2) {
      return registry.find((schema) => NormalizedSchema.of(schema).getMergedTraits().awsQueryError?.[0] === errorName);
    }
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/ConfigurableSerdeContext.js
var SerdeContextConfig = class {
  static {
    __name(this, "SerdeContextConfig");
  }
  serdeContext;
  setSerdeContext(serdeContext) {
    this.serdeContext = serdeContext;
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/UnionSerde.js
var UnionSerde = class {
  static {
    __name(this, "UnionSerde");
  }
  from;
  to;
  keys;
  constructor(from, to) {
    this.from = from;
    this.to = to;
    const keys = Object.keys(this.from);
    const set = new Set(keys);
    set.delete("__type");
    this.keys = set;
  }
  mark(key) {
    this.keys.delete(key);
  }
  hasUnknown() {
    return this.keys.size === 1 && Object.keys(this.to).length === 0;
  }
  writeUnknown() {
    if (this.hasUnknown()) {
      const k2 = this.keys.values().next().value;
      const v2 = this.from[k2];
      this.to.$unknown = [k2, v2];
    }
  }
};

// node_modules/@aws-sdk/xml-builder/dist-es/escape-attribute.js
var ATTR_ESCAPE_RE = /[&<>"]/g;
var ATTR_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};
function escapeAttribute(value) {
  return value.replace(ATTR_ESCAPE_RE, (ch) => ATTR_ESCAPE_MAP[ch]);
}
__name(escapeAttribute, "escapeAttribute");

// node_modules/@aws-sdk/xml-builder/dist-es/escape-element.js
var ELEMENT_ESCAPE_RE = /[&"'<>\r\n\u0085\u2028]/g;
var ELEMENT_ESCAPE_MAP = {
  "&": "&amp;",
  '"': "&quot;",
  "'": "&apos;",
  "<": "&lt;",
  ">": "&gt;",
  "\r": "&#x0D;",
  "\n": "&#x0A;",
  "\x85": "&#x85;",
  "\u2028": "&#x2028;"
};
function escapeElement(value) {
  return value.replace(ELEMENT_ESCAPE_RE, (ch) => ELEMENT_ESCAPE_MAP[ch]);
}
__name(escapeElement, "escapeElement");

// node_modules/@aws-sdk/xml-builder/dist-es/XmlText.js
var XmlText = class {
  static {
    __name(this, "XmlText");
  }
  value;
  constructor(value) {
    this.value = value;
  }
  toString() {
    return escapeElement("" + this.value);
  }
};

// node_modules/@aws-sdk/xml-builder/dist-es/XmlNode.js
var XmlNode = class _XmlNode {
  static {
    __name(this, "XmlNode");
  }
  name;
  children;
  attributes = {};
  static of(name, childText, withName) {
    const node = new _XmlNode(name);
    if (childText !== void 0) {
      node.addChildNode(new XmlText(childText));
    }
    if (withName !== void 0) {
      node.withName(withName);
    }
    return node;
  }
  constructor(name, children = []) {
    this.name = name;
    this.children = children;
  }
  withName(name) {
    this.name = name;
    return this;
  }
  addAttribute(name, value) {
    this.attributes[name] = value;
    return this;
  }
  addChildNode(child) {
    this.children.push(child);
    return this;
  }
  removeAttribute(name) {
    delete this.attributes[name];
    return this;
  }
  n(name) {
    this.name = name;
    return this;
  }
  c(child) {
    this.children.push(child);
    return this;
  }
  a(name, value) {
    if (value != null) {
      this.attributes[name] = value;
    }
    return this;
  }
  cc(input, field, withName = field) {
    if (input[field] != null) {
      const node = _XmlNode.of(field, input[field]).withName(withName);
      this.c(node);
    }
  }
  l(input, listName, memberName, valueProvider) {
    if (input[listName] != null) {
      const nodes2 = valueProvider();
      nodes2.map((node) => {
        node.withName(memberName);
        this.c(node);
      });
    }
  }
  lc(input, listName, memberName, valueProvider) {
    if (input[listName] != null) {
      const nodes2 = valueProvider();
      const containerNode = new _XmlNode(memberName);
      nodes2.map((node) => {
        containerNode.c(node);
      });
      this.c(containerNode);
    }
  }
  toString() {
    const hasChildren2 = Boolean(this.children.length);
    let xmlText = `<${this.name}`;
    const attributes = this.attributes;
    for (const attributeName of Object.keys(attributes)) {
      const attribute = attributes[attributeName];
      if (attribute != null) {
        xmlText += ` ${attributeName}="${escapeAttribute("" + attribute)}"`;
      }
    }
    return xmlText += !hasChildren2 ? "/>" : `>${this.children.map((c2) => c2.toString()).join("")}</${this.name}>`;
  }
};

// node_modules/@aws-sdk/xml-builder/dist-es/xml-parser.browser.js
var parser;
function parseXML(xmlString) {
  if (!parser) {
    parser = new DOMParser();
  }
  const xmlDocument = parser.parseFromString(xmlString, "application/xml");
  if (xmlDocument.getElementsByTagName("parsererror").length > 0) {
    throw new Error("DOMParser XML parsing error.");
  }
  const xmlToObj = /* @__PURE__ */ __name((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent?.trim()) {
        return node.textContent;
      }
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node;
      if (element.attributes.length === 0 && element.childNodes.length === 0) {
        return "";
      }
      const obj = {};
      const attributes = Array.from(element.attributes);
      for (const attr of attributes) {
        obj[`${attr.name}`] = attr.value;
      }
      const childNodes = Array.from(element.childNodes);
      for (const child of childNodes) {
        const childResult = xmlToObj(child);
        if (childResult != null) {
          const childName = child.nodeName;
          if (childNodes.length === 1 && attributes.length === 0 && childName === "#text") {
            return childResult;
          }
          if (obj[childName]) {
            if (Array.isArray(obj[childName])) {
              obj[childName].push(childResult);
            } else {
              obj[childName] = [obj[childName], childResult];
            }
          } else {
            obj[childName] = childResult;
          }
        } else if (childNodes.length === 1 && attributes.length === 0) {
          return element.textContent;
        }
      }
      return obj;
    }
    return null;
  }, "xmlToObj");
  return {
    [xmlDocument.documentElement.nodeName]: xmlToObj(xmlDocument.documentElement)
  };
}
__name(parseXML, "parseXML");

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/XmlShapeDeserializer.js
init_client3();
init_protocols();
init_schema2();
init_index_browser2();
var XmlShapeDeserializer = class extends SerdeContextConfig {
  static {
    __name(this, "XmlShapeDeserializer");
  }
  settings;
  stringDeserializer;
  constructor(settings) {
    super();
    this.settings = settings;
    this.stringDeserializer = new FromStringShapeDeserializer(settings);
  }
  setSerdeContext(serdeContext) {
    this.serdeContext = serdeContext;
    this.stringDeserializer.setSerdeContext(serdeContext);
  }
  read(schema, bytes, key) {
    const ns = NormalizedSchema.of(schema);
    const memberSchemas = ns.getMemberSchemas();
    const isEventPayload = ns.isStructSchema() && ns.isMemberSchema() && !!Object.values(memberSchemas).find((memberNs) => {
      return !!memberNs.getMemberTraits().eventPayload;
    });
    if (isEventPayload) {
      const output = {};
      const memberName = Object.keys(memberSchemas)[0];
      const eventMemberSchema = memberSchemas[memberName];
      if (eventMemberSchema.isBlobSchema()) {
        output[memberName] = bytes;
      } else {
        output[memberName] = this.read(memberSchemas[memberName], bytes);
      }
      return output;
    }
    const xmlString = (this.serdeContext?.utf8Encoder ?? toUtf8)(bytes);
    const parsedObject = this.parseXml(xmlString);
    return this.readSchema(schema, key ? parsedObject[key] : parsedObject);
  }
  readSchema(_schema, value) {
    const ns = NormalizedSchema.of(_schema);
    if (ns.isUnitSchema()) {
      return;
    }
    const traits = ns.getMergedTraits();
    if (ns.isListSchema() && !Array.isArray(value)) {
      return this.readSchema(ns, [value]);
    }
    if (value == null) {
      return value;
    }
    if (typeof value === "object") {
      const flat = !!traits.xmlFlattened;
      if (ns.isListSchema()) {
        const listValue = ns.getValueSchema();
        const buffer2 = [];
        const sourceKey = listValue.getMergedTraits().xmlName ?? "member";
        const source = flat ? value : (value[0] ?? value)[sourceKey];
        if (source == null) {
          return buffer2;
        }
        const sourceArray = Array.isArray(source) ? source : [source];
        for (const v2 of sourceArray) {
          buffer2.push(this.readSchema(listValue, v2));
        }
        return buffer2;
      }
      const buffer = {};
      if (ns.isMapSchema()) {
        const keyNs = ns.getKeySchema();
        const memberNs = ns.getValueSchema();
        let entries;
        if (flat) {
          entries = Array.isArray(value) ? value : [value];
        } else {
          entries = Array.isArray(value.entry) ? value.entry : [value.entry];
        }
        const keyProperty = keyNs.getMergedTraits().xmlName ?? "key";
        const valueProperty = memberNs.getMergedTraits().xmlName ?? "value";
        for (const entry of entries) {
          const key = entry[keyProperty];
          const value2 = entry[valueProperty];
          buffer[key] = this.readSchema(memberNs, value2);
        }
        return buffer;
      }
      if (ns.isStructSchema()) {
        const union = ns.isUnionSchema();
        let unionSerde;
        if (union) {
          unionSerde = new UnionSerde(value, buffer);
        }
        for (const [memberName, memberSchema] of ns.structIterator()) {
          const memberTraits = memberSchema.getMergedTraits();
          const xmlObjectKey = !memberTraits.httpPayload ? memberSchema.getMemberTraits().xmlName ?? memberName : memberTraits.xmlName ?? memberSchema.getName();
          if (union) {
            unionSerde.mark(xmlObjectKey);
          }
          if (value[xmlObjectKey] != null) {
            buffer[memberName] = this.readSchema(memberSchema, value[xmlObjectKey]);
          }
        }
        if (union) {
          unionSerde.writeUnknown();
        }
        return buffer;
      }
      if (ns.isDocumentSchema()) {
        return value;
      }
      throw new Error(`@aws-sdk/core/protocols - xml deserializer unhandled schema type for ${ns.getName(true)}`);
    }
    if (ns.isListSchema()) {
      return [];
    }
    if (ns.isMapSchema() || ns.isStructSchema()) {
      return {};
    }
    return this.stringDeserializer.read(ns, value);
  }
  parseXml(xml) {
    if (xml.length) {
      let parsedObj;
      try {
        parsedObj = parseXML(xml);
      } catch (e2) {
        if (e2 && typeof e2 === "object") {
          Object.defineProperty(e2, "$responseBodyText", {
            value: xml
          });
        }
        throw e2;
      }
      const textNodeName = "#text";
      const key = Object.keys(parsedObj)[0];
      const parsedObjToReturn = parsedObj[key];
      if (parsedObjToReturn[textNodeName]) {
        parsedObjToReturn[key] = parsedObjToReturn[textNodeName];
        delete parsedObjToReturn[textNodeName];
      }
      return getValueFromTextNode(parsedObjToReturn);
    }
    return {};
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/AwsRestXmlProtocol.js
init_protocols();
init_schema2();

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/parseXmlBody.js
var loadRestXmlErrorCode = /* @__PURE__ */ __name((output, data) => {
  if (data?.Error?.Code !== void 0) {
    return data.Error.Code;
  }
  if (data?.Code !== void 0) {
    return data.Code;
  }
  if (output.statusCode == 404) {
    return "NotFound";
  }
}, "loadRestXmlErrorCode");

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/XmlShapeSerializer.js
init_protocols();
init_schema2();
init_index_browser2();
init_index_browser2();
var XmlShapeSerializer = class extends SerdeContextConfig {
  static {
    __name(this, "XmlShapeSerializer");
  }
  settings;
  stringBuffer;
  byteBuffer;
  buffer;
  constructor(settings) {
    super();
    this.settings = settings;
  }
  write(schema, value) {
    const ns = NormalizedSchema.of(schema);
    if (ns.isStringSchema() && typeof value === "string") {
      this.stringBuffer = value;
    } else if (ns.isBlobSchema()) {
      this.byteBuffer = "byteLength" in value ? value : (this.serdeContext?.base64Decoder ?? fromBase64)(value);
    } else {
      this.buffer = this.writeStruct(ns, value, void 0);
      const traits = ns.getMergedTraits();
      if (traits.httpPayload && !traits.xmlName) {
        this.buffer.withName(ns.getName());
      }
    }
  }
  flush() {
    if (this.byteBuffer !== void 0) {
      const bytes = this.byteBuffer;
      delete this.byteBuffer;
      return bytes;
    }
    if (this.stringBuffer !== void 0) {
      const str = this.stringBuffer;
      delete this.stringBuffer;
      return str;
    }
    const buffer = this.buffer;
    if (this.settings.xmlNamespace) {
      if (!buffer?.attributes?.["xmlns"]) {
        buffer.addAttribute("xmlns", this.settings.xmlNamespace);
      }
    }
    delete this.buffer;
    return buffer.toString();
  }
  writeStruct(ns, value, parentXmlns) {
    const traits = ns.getMergedTraits();
    const name = ns.isMemberSchema() && !traits.httpPayload ? ns.getMemberTraits().xmlName ?? ns.getMemberName() : traits.xmlName ?? ns.getName();
    if (!name || !ns.isStructSchema()) {
      throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write struct with empty name or non-struct, schema=${ns.getName(true)}.`);
    }
    const structXmlNode = XmlNode.of(name);
    const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(ns, parentXmlns);
    for (const [memberName, memberSchema] of ns.structIterator()) {
      const val = value[memberName];
      if (val != null || memberSchema.isIdempotencyToken()) {
        if (memberSchema.getMergedTraits().xmlAttribute) {
          structXmlNode.addAttribute(memberSchema.getMergedTraits().xmlName ?? memberName, this.writeSimple(memberSchema, val));
          continue;
        }
        if (memberSchema.isListSchema()) {
          this.writeList(memberSchema, val, structXmlNode, xmlns);
        } else if (memberSchema.isMapSchema()) {
          this.writeMap(memberSchema, val, structXmlNode, xmlns);
        } else if (memberSchema.isStructSchema()) {
          structXmlNode.addChildNode(this.writeStruct(memberSchema, val, xmlns));
        } else {
          const memberNode = XmlNode.of(memberSchema.getMergedTraits().xmlName ?? memberSchema.getMemberName());
          this.writeSimpleInto(memberSchema, val, memberNode, xmlns);
          structXmlNode.addChildNode(memberNode);
        }
      }
    }
    const { $unknown } = value;
    if ($unknown && ns.isUnionSchema() && Array.isArray($unknown) && Object.keys(value).length === 1) {
      const [k2, v2] = $unknown;
      const node = XmlNode.of(k2);
      if (typeof v2 !== "string") {
        if (value instanceof XmlNode || value instanceof XmlText) {
          structXmlNode.addChildNode(value);
        } else {
          throw new Error(`@aws-sdk - $unknown union member in XML requires value of type string, @aws-sdk/xml-builder::XmlNode or XmlText.`);
        }
      }
      this.writeSimpleInto(0, v2, node, xmlns);
      structXmlNode.addChildNode(node);
    }
    if (xmlns) {
      structXmlNode.addAttribute(xmlnsAttr, xmlns);
    }
    return structXmlNode;
  }
  writeList(listMember, array, container, parentXmlns) {
    if (!listMember.isMemberSchema()) {
      throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write non-member list: ${listMember.getName(true)}`);
    }
    const listTraits = listMember.getMergedTraits();
    const listValueSchema = listMember.getValueSchema();
    const listValueTraits = listValueSchema.getMergedTraits();
    const sparse = !!listValueTraits.sparse;
    const flat = !!listTraits.xmlFlattened;
    const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(listMember, parentXmlns);
    const writeItem = /* @__PURE__ */ __name((container2, value) => {
      if (listValueSchema.isListSchema()) {
        this.writeList(listValueSchema, Array.isArray(value) ? value : [value], container2, xmlns);
      } else if (listValueSchema.isMapSchema()) {
        this.writeMap(listValueSchema, value, container2, xmlns);
      } else if (listValueSchema.isStructSchema()) {
        const struct = this.writeStruct(listValueSchema, value, xmlns);
        container2.addChildNode(struct.withName(flat ? listTraits.xmlName ?? listMember.getMemberName() : listValueTraits.xmlName ?? "member"));
      } else {
        const listItemNode = XmlNode.of(flat ? listTraits.xmlName ?? listMember.getMemberName() : listValueTraits.xmlName ?? "member");
        this.writeSimpleInto(listValueSchema, value, listItemNode, xmlns);
        container2.addChildNode(listItemNode);
      }
    }, "writeItem");
    if (flat) {
      for (const value of array) {
        if (sparse || value != null) {
          writeItem(container, value);
        }
      }
    } else {
      const listNode = XmlNode.of(listTraits.xmlName ?? listMember.getMemberName());
      if (xmlns) {
        listNode.addAttribute(xmlnsAttr, xmlns);
      }
      for (const value of array) {
        if (sparse || value != null) {
          writeItem(listNode, value);
        }
      }
      container.addChildNode(listNode);
    }
  }
  writeMap(mapMember, map, container, parentXmlns, containerIsMap = false) {
    if (!mapMember.isMemberSchema()) {
      throw new Error(`@aws-sdk/core/protocols - xml serializer, cannot write non-member map: ${mapMember.getName(true)}`);
    }
    const mapTraits = mapMember.getMergedTraits();
    const mapKeySchema = mapMember.getKeySchema();
    const mapKeyTraits = mapKeySchema.getMergedTraits();
    const keyTag = mapKeyTraits.xmlName ?? "key";
    const mapValueSchema = mapMember.getValueSchema();
    const mapValueTraits = mapValueSchema.getMergedTraits();
    const valueTag = mapValueTraits.xmlName ?? "value";
    const sparse = !!mapValueTraits.sparse;
    const flat = !!mapTraits.xmlFlattened;
    const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(mapMember, parentXmlns);
    const addKeyValue = /* @__PURE__ */ __name((entry, key, val) => {
      const keyNode = XmlNode.of(keyTag, key);
      const [keyXmlnsAttr, keyXmlns] = this.getXmlnsAttribute(mapKeySchema, xmlns);
      if (keyXmlns) {
        keyNode.addAttribute(keyXmlnsAttr, keyXmlns);
      }
      entry.addChildNode(keyNode);
      let valueNode = XmlNode.of(valueTag);
      if (mapValueSchema.isListSchema()) {
        this.writeList(mapValueSchema, val, valueNode, xmlns);
      } else if (mapValueSchema.isMapSchema()) {
        this.writeMap(mapValueSchema, val, valueNode, xmlns, true);
      } else if (mapValueSchema.isStructSchema()) {
        valueNode = this.writeStruct(mapValueSchema, val, xmlns);
      } else {
        this.writeSimpleInto(mapValueSchema, val, valueNode, xmlns);
      }
      entry.addChildNode(valueNode);
    }, "addKeyValue");
    if (flat) {
      for (const key in map) {
        const val = map[key];
        if (sparse || val != null) {
          const entry = XmlNode.of(mapTraits.xmlName ?? mapMember.getMemberName());
          addKeyValue(entry, key, val);
          container.addChildNode(entry);
        }
      }
    } else {
      let mapNode;
      if (!containerIsMap) {
        mapNode = XmlNode.of(mapTraits.xmlName ?? mapMember.getMemberName());
        if (xmlns) {
          mapNode.addAttribute(xmlnsAttr, xmlns);
        }
        container.addChildNode(mapNode);
      }
      for (const key in map) {
        const val = map[key];
        if (sparse || val != null) {
          const entry = XmlNode.of("entry");
          addKeyValue(entry, key, val);
          (containerIsMap ? container : mapNode).addChildNode(entry);
        }
      }
    }
  }
  writeSimple(_schema, value) {
    if (null === value) {
      throw new Error("@aws-sdk/core/protocols - (XML serializer) cannot write null value.");
    }
    const ns = NormalizedSchema.of(_schema);
    let nodeContents = null;
    if (value && typeof value === "object") {
      if (ns.isBlobSchema()) {
        nodeContents = (this.serdeContext?.base64Encoder ?? toBase64)(value);
      } else if (ns.isTimestampSchema() && value instanceof Date) {
        const format2 = determineTimestampFormat(ns, this.settings);
        switch (format2) {
          case 5:
            nodeContents = value.toISOString().replace(".000Z", "Z");
            break;
          case 6:
            nodeContents = dateToUtcString(value);
            break;
          case 7:
            nodeContents = String(value.getTime() / 1e3);
            break;
          default:
            console.warn("Missing timestamp format, using http date", value);
            nodeContents = dateToUtcString(value);
            break;
        }
      } else if (ns.isBigDecimalSchema() && value) {
        if (value instanceof NumericValue) {
          return value.string;
        }
        return String(value);
      } else if (ns.isMapSchema() || ns.isListSchema()) {
        throw new Error("@aws-sdk/core/protocols - xml serializer, cannot call _write() on List/Map schema, call writeList or writeMap() instead.");
      } else {
        throw new Error(`@aws-sdk/core/protocols - xml serializer, unhandled schema type for object value and schema: ${ns.getName(true)}`);
      }
    }
    if (ns.isBooleanSchema() || ns.isNumericSchema() || ns.isBigIntegerSchema() || ns.isBigDecimalSchema()) {
      nodeContents = String(value);
    }
    if (ns.isStringSchema()) {
      if (value === void 0 && ns.isIdempotencyToken()) {
        nodeContents = generateIdempotencyToken();
      } else {
        nodeContents = String(value);
      }
    }
    if (nodeContents === null) {
      throw new Error(`Unhandled schema-value pair ${ns.getName(true)}=${value}`);
    }
    return nodeContents;
  }
  writeSimpleInto(_schema, value, into, parentXmlns) {
    const nodeContents = this.writeSimple(_schema, value);
    const ns = NormalizedSchema.of(_schema);
    const content = new XmlText(nodeContents);
    const [xmlnsAttr, xmlns] = this.getXmlnsAttribute(ns, parentXmlns);
    if (xmlns) {
      into.addAttribute(xmlnsAttr, xmlns);
    }
    into.addChildNode(content);
  }
  getXmlnsAttribute(ns, parentXmlns) {
    const traits = ns.getMergedTraits();
    const [prefix, xmlns] = traits.xmlNamespace ?? [];
    if (xmlns && xmlns !== parentXmlns) {
      return [prefix ? `xmlns:${prefix}` : "xmlns", xmlns];
    }
    return [void 0, void 0];
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/XmlCodec.js
var XmlCodec = class extends SerdeContextConfig {
  static {
    __name(this, "XmlCodec");
  }
  settings;
  constructor(settings) {
    super();
    this.settings = settings;
  }
  createSerializer() {
    const serializer = new XmlShapeSerializer(this.settings);
    serializer.setSerdeContext(this.serdeContext);
    return serializer;
  }
  createDeserializer() {
    const deserializer = new XmlShapeDeserializer(this.settings);
    deserializer.setSerdeContext(this.serdeContext);
    return deserializer;
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/protocols/xml/AwsRestXmlProtocol.js
var AwsRestXmlProtocol = class extends HttpBindingProtocol {
  static {
    __name(this, "AwsRestXmlProtocol");
  }
  codec;
  serializer;
  deserializer;
  mixin = new ProtocolLib();
  constructor(options) {
    super(options);
    const settings = {
      timestampFormat: {
        useTrait: true,
        default: 5
      },
      httpBindings: true,
      xmlNamespace: options.xmlNamespace,
      serviceNamespace: options.defaultNamespace
    };
    this.codec = new XmlCodec(settings);
    this.serializer = new HttpInterceptingShapeSerializer(this.codec.createSerializer(), settings);
    this.deserializer = new HttpInterceptingShapeDeserializer(this.codec.createDeserializer(), settings);
  }
  getPayloadCodec() {
    return this.codec;
  }
  getShapeId() {
    return "aws.protocols#restXml";
  }
  async serializeRequest(operationSchema, input, context) {
    const request = await super.serializeRequest(operationSchema, input, context);
    const inputSchema = NormalizedSchema.of(operationSchema.input);
    if (!request.headers["content-type"]) {
      const contentType = this.mixin.resolveRestContentType(this.getDefaultContentType(), inputSchema);
      if (contentType) {
        request.headers["content-type"] = contentType;
      }
    }
    if (typeof request.body === "string" && request.headers["content-type"] === this.getDefaultContentType() && !request.body.startsWith("<?xml ") && !this.hasUnstructuredPayloadBinding(inputSchema)) {
      request.body = '<?xml version="1.0" encoding="UTF-8"?>' + request.body;
    }
    return request;
  }
  async deserializeResponse(operationSchema, context, response) {
    return super.deserializeResponse(operationSchema, context, response);
  }
  async handleError(operationSchema, context, response, dataObject, metadata) {
    const errorIdentifier = loadRestXmlErrorCode(response, dataObject) ?? "Unknown";
    this.mixin.compose(this.compositeErrorRegistry, errorIdentifier, this.options.defaultNamespace);
    if (dataObject.Error && typeof dataObject.Error === "object") {
      for (const key of Object.keys(dataObject.Error)) {
        dataObject[key] = dataObject.Error[key];
        if (key.toLowerCase() === "message") {
          dataObject.message = dataObject.Error[key];
        }
      }
    }
    if (dataObject.RequestId && !metadata.requestId) {
      metadata.requestId = dataObject.RequestId;
    }
    const { errorSchema, errorMetadata } = await this.mixin.getErrorSchemaOrThrowBaseException(errorIdentifier, this.options.defaultNamespace, response, dataObject, metadata);
    const ns = NormalizedSchema.of(errorSchema);
    const message = dataObject.Error?.message ?? dataObject.Error?.Message ?? dataObject.message ?? dataObject.Message ?? "UnknownError";
    const ErrorCtor = this.compositeErrorRegistry.getErrorCtor(errorSchema) ?? Error;
    const exception = new ErrorCtor({});
    await this.deserializeHttpMessage(errorSchema, context, response, dataObject);
    const output = {};
    const errorDeserializer = this.codec.createDeserializer();
    for (const [name, member2] of ns.structIterator()) {
      const target = member2.getMergedTraits().xmlName ?? name;
      const value = dataObject.Error?.[target] ?? dataObject[target];
      output[name] = errorDeserializer.readSchema(member2, value);
    }
    throw this.mixin.decorateServiceException(Object.assign(exception, errorMetadata, {
      $fault: ns.getMergedTraits().error,
      message
    }, output), dataObject);
  }
  getDefaultContentType() {
    return "application/xml";
  }
  hasUnstructuredPayloadBinding(ns) {
    for (const [, member2] of ns.structIterator()) {
      if (member2.getMergedTraits().httpPayload) {
        return !(member2.isStructSchema() || member2.isMapSchema() || member2.isListSchema());
      }
    }
    return false;
  }
};

// node_modules/@aws-sdk/middleware-sdk-s3/dist-es/protocol/S3RestXmlProtocol.js
init_schema2();
var S3RestXmlProtocol = class extends AwsRestXmlProtocol {
  static {
    __name(this, "S3RestXmlProtocol");
  }
  async serializeRequest(operationSchema, input, context) {
    const request = await super.serializeRequest(operationSchema, input, context);
    const ns = NormalizedSchema.of(operationSchema.input);
    const staticStructureSchema = ns.getSchema();
    let bucketMemberIndex = 0;
    const requiredMemberCount = staticStructureSchema[6] ?? 0;
    if (input && typeof input === "object") {
      for (const [memberName, memberNs] of ns.structIterator()) {
        if (++bucketMemberIndex > requiredMemberCount) {
          break;
        }
        if (memberName === "Bucket") {
          if (!input.Bucket && memberNs.getMergedTraits().httpLabel) {
            throw new Error(`No value provided for input HTTP label: Bucket.`);
          }
          break;
        }
      }
    }
    return request;
  }
};

// node_modules/@aws-sdk/client-s3/dist-es/S3Client.js
init_client3();
init_index_browser();
init_index_browser3();
init_protocols();
init_schema2();

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/AwsSdkSigV4Signer.js
init_protocols();

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/utils/getDateHeader.js
init_protocols();
var getDateHeader = /* @__PURE__ */ __name((response) => HttpResponse.isInstance(response) ? response.headers?.date ?? response.headers?.Date : void 0, "getDateHeader");

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/utils/getSkewCorrectedDate.js
var getSkewCorrectedDate = /* @__PURE__ */ __name((systemClockOffset) => new Date(Date.now() + systemClockOffset), "getSkewCorrectedDate");

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/utils/isClockSkewed.js
var isClockSkewed = /* @__PURE__ */ __name((clockTime, systemClockOffset) => Math.abs(getSkewCorrectedDate(systemClockOffset).getTime() - clockTime) >= 3e5, "isClockSkewed");

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/utils/getUpdatedSystemClockOffset.js
var getUpdatedSystemClockOffset = /* @__PURE__ */ __name((clockTime, currentSystemClockOffset) => {
  const clockTimeInMs = Date.parse(clockTime);
  if (isClockSkewed(clockTimeInMs, currentSystemClockOffset)) {
    return clockTimeInMs - Date.now();
  }
  return currentSystemClockOffset;
}, "getUpdatedSystemClockOffset");

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/AwsSdkSigV4Signer.js
var throwSigningPropertyError = /* @__PURE__ */ __name((name, property) => {
  if (!property) {
    throw new Error(`Property \`${name}\` is not resolved for AWS SDK SigV4Auth`);
  }
  return property;
}, "throwSigningPropertyError");
var validateSigningProperties = /* @__PURE__ */ __name(async (signingProperties) => {
  const context = throwSigningPropertyError("context", signingProperties.context);
  const config = throwSigningPropertyError("config", signingProperties.config);
  const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
  const signerFunction = throwSigningPropertyError("signer", config.signer);
  const signer = await signerFunction(authScheme);
  const signingRegion = signingProperties?.signingRegion;
  const signingRegionSet = signingProperties?.signingRegionSet;
  const signingName = signingProperties?.signingName;
  return {
    config,
    signer,
    signingRegion,
    signingRegionSet,
    signingName
  };
}, "validateSigningProperties");
var AwsSdkSigV4Signer = class {
  static {
    __name(this, "AwsSdkSigV4Signer");
  }
  async sign(httpRequest, identity, signingProperties) {
    if (!HttpRequest.isInstance(httpRequest)) {
      throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
    }
    const validatedProps = await validateSigningProperties(signingProperties);
    const { config, signer } = validatedProps;
    let { signingRegion, signingName } = validatedProps;
    const handlerExecutionContext = signingProperties.context;
    if (handlerExecutionContext?.authSchemes?.length ?? 0 > 1) {
      const [first, second] = handlerExecutionContext.authSchemes;
      if (first?.name === "sigv4a" && second?.name === "sigv4") {
        signingRegion = second?.signingRegion ?? signingRegion;
        signingName = second?.signingName ?? signingName;
      }
    }
    const signedRequest = await signer.sign(httpRequest, {
      signingDate: getSkewCorrectedDate(config.systemClockOffset),
      signingRegion,
      signingService: signingName
    });
    return signedRequest;
  }
  errorHandler(signingProperties) {
    return (error) => {
      const serverTime = error.ServerTime ?? getDateHeader(error.$response);
      if (serverTime) {
        const config = throwSigningPropertyError("config", signingProperties.config);
        const initialSystemClockOffset = config.systemClockOffset;
        config.systemClockOffset = getUpdatedSystemClockOffset(serverTime, config.systemClockOffset);
        const clockSkewCorrected = config.systemClockOffset !== initialSystemClockOffset;
        if (clockSkewCorrected && error.$metadata) {
          error.$metadata.clockSkewCorrected = true;
        }
      }
      throw error;
    };
  }
  successHandler(httpResponse, signingProperties) {
    const dateHeader = getDateHeader(httpResponse);
    if (dateHeader) {
      const config = throwSigningPropertyError("config", signingProperties.config);
      config.systemClockOffset = getUpdatedSystemClockOffset(dateHeader, config.systemClockOffset);
    }
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/AwsSdkSigV4ASigner.js
init_protocols();
var AwsSdkSigV4ASigner = class extends AwsSdkSigV4Signer {
  static {
    __name(this, "AwsSdkSigV4ASigner");
  }
  async sign(httpRequest, identity, signingProperties) {
    if (!HttpRequest.isInstance(httpRequest)) {
      throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
    }
    const { config, signer, signingRegion, signingRegionSet, signingName } = await validateSigningProperties(signingProperties);
    const configResolvedSigningRegionSet = await config.sigv4aSigningRegionSet?.();
    const multiRegionOverride = (configResolvedSigningRegionSet ?? signingRegionSet ?? [signingRegion]).join(",");
    const signedRequest = await signer.sign(httpRequest, {
      signingDate: getSkewCorrectedDate(config.systemClockOffset),
      signingRegion: multiRegionOverride,
      signingService: signingName
    });
    return signedRequest;
  }
};

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/resolveAwsSdkSigV4AConfig.js
var resolveAwsSdkSigV4AConfig = /* @__PURE__ */ __name((config) => {
  config.sigv4aSigningRegionSet = normalizeProvider2(config.sigv4aSigningRegionSet);
  return config;
}, "resolveAwsSdkSigV4AConfig");

// node_modules/@aws-sdk/core/dist-es/submodules/httpAuthSchemes/aws_sdk/resolveAwsSdkSigV4Config.js
var resolveAwsSdkSigV4Config = /* @__PURE__ */ __name((config) => {
  let inputCredentials = config.credentials;
  let isUserSupplied = !!config.credentials;
  let resolvedCredentials = void 0;
  Object.defineProperty(config, "credentials", {
    set(credentials) {
      if (credentials && credentials !== inputCredentials && credentials !== resolvedCredentials) {
        isUserSupplied = true;
      }
      inputCredentials = credentials;
      const memoizedProvider = normalizeCredentialProvider(config, {
        credentials: inputCredentials,
        credentialDefaultProvider: config.credentialDefaultProvider
      });
      const boundProvider = bindCallerConfig(config, memoizedProvider);
      if (isUserSupplied && !boundProvider.attributed) {
        const isCredentialObject = typeof inputCredentials === "object" && inputCredentials !== null;
        resolvedCredentials = /* @__PURE__ */ __name(async (options) => {
          const creds = await boundProvider(options);
          const attributedCreds = creds;
          if (isCredentialObject && (!attributedCreds.$source || Object.keys(attributedCreds.$source).length === 0)) {
            return setCredentialFeature(attributedCreds, "CREDENTIALS_CODE", "e");
          }
          return attributedCreds;
        }, "resolvedCredentials");
        resolvedCredentials.memoized = boundProvider.memoized;
        resolvedCredentials.configBound = boundProvider.configBound;
        resolvedCredentials.attributed = true;
      } else {
        resolvedCredentials = boundProvider;
      }
    },
    get() {
      return resolvedCredentials;
    },
    enumerable: true,
    configurable: true
  });
  config.credentials = inputCredentials;
  const { signingEscapePath = true, systemClockOffset = config.systemClockOffset || 0, sha256: sha2562 } = config;
  let signer;
  if (config.signer) {
    signer = normalizeProvider2(config.signer);
  } else if (config.regionInfoProvider) {
    signer = /* @__PURE__ */ __name(() => normalizeProvider2(config.region)().then(async (region) => [
      await config.regionInfoProvider(region, {
        useFipsEndpoint: await config.useFipsEndpoint(),
        useDualstackEndpoint: await config.useDualstackEndpoint()
      }) || {},
      region
    ]).then(([regionInfo, region]) => {
      const { signingRegion, signingService } = regionInfo;
      config.signingRegion = config.signingRegion || signingRegion || region;
      config.signingName = config.signingName || signingService || config.serviceId;
      const params = {
        ...config,
        credentials: config.credentials,
        region: config.signingRegion,
        service: config.signingName,
        sha256: sha2562,
        uriEscapePath: signingEscapePath
      };
      const SignerCtor = config.signerConstructor || SignatureV4;
      return new SignerCtor(params);
    }), "signer");
  } else {
    signer = /* @__PURE__ */ __name(async (authScheme) => {
      authScheme = Object.assign({}, {
        name: "sigv4",
        signingName: config.signingName || config.defaultSigningName,
        signingRegion: await normalizeProvider2(config.region)(),
        properties: {}
      }, authScheme);
      const signingRegion = authScheme.signingRegion;
      const signingService = authScheme.signingName;
      config.signingRegion = config.signingRegion || signingRegion;
      config.signingName = config.signingName || signingService || config.serviceId;
      const params = {
        ...config,
        credentials: config.credentials,
        region: config.signingRegion,
        service: config.signingName,
        sha256: sha2562,
        uriEscapePath: signingEscapePath
      };
      const SignerCtor = config.signerConstructor || SignatureV4;
      return new SignerCtor(params);
    }, "signer");
  }
  const resolvedConfig = Object.assign(config, {
    systemClockOffset,
    signingEscapePath,
    signer
  });
  return resolvedConfig;
}, "resolveAwsSdkSigV4Config");
function normalizeCredentialProvider(config, { credentials, credentialDefaultProvider }) {
  let credentialsProvider;
  if (credentials) {
    if (!credentials?.memoized) {
      credentialsProvider = memoizeIdentityProvider(credentials, isIdentityExpired, doesIdentityRequireRefresh);
    } else {
      credentialsProvider = credentials;
    }
  } else {
    if (credentialDefaultProvider) {
      credentialsProvider = normalizeProvider2(credentialDefaultProvider(Object.assign({}, config, {
        parentClientConfig: config
      })));
    } else {
      credentialsProvider = /* @__PURE__ */ __name(async () => {
        throw new Error("@aws-sdk/core::resolveAwsSdkSigV4Config - `credentials` not provided and no credentialDefaultProvider was configured.");
      }, "credentialsProvider");
    }
  }
  credentialsProvider.memoized = true;
  return credentialsProvider;
}
__name(normalizeCredentialProvider, "normalizeCredentialProvider");
function bindCallerConfig(config, credentialsProvider) {
  if (credentialsProvider.configBound) {
    return credentialsProvider;
  }
  const fn = /* @__PURE__ */ __name(async (options) => credentialsProvider({ ...options, callerClientConfig: config }), "fn");
  fn.memoized = credentialsProvider.memoized;
  fn.configBound = true;
  return fn;
}
__name(bindCallerConfig, "bindCallerConfig");

// node_modules/@aws-sdk/client-s3/dist-es/auth/httpAuthSchemeProvider.js
init_client3();
init_index_browser();

// node_modules/@aws-sdk/client-s3/dist-es/endpoint/endpointResolver.js
init_index_browser();

// node_modules/@aws-sdk/client-s3/dist-es/endpoint/bdd.js
init_index_browser();
var aw = "ref";
var ax = "argv";
var ay = "backend";
var az = "authSchemes";
var aA = "disableDoubleEncoding";
var aB = "signingName";
var aC = "signingRegion";
var aD = "signingRegionSet";
var a = -1;
var b = true;
var c = false;
var d = "isSet";
var e = "booleanEquals";
var f = "stringEquals";
var g = "coalesce";
var h = "substring";
var i = "";
var j = "aws.partition";
var k = "partitionResult";
var l = "accessPointSuffix";
var m = "regionPrefix";
var n = /* @__PURE__ */ __name((n2) => "outpostId_ssa_" + n2 + i, "n");
var o = "hardwareType";
var p = "ite";
var q = "isValidHostLabel";
var s = "sigv4";
var t = "aws.isVirtualHostableS3Bucket";
var u = "url";
var v = "getAttr";
var w = "bucketArn";
var x = "--";
var y = "arnType";
var z = "accesspoint";
var A = /* @__PURE__ */ __name((n2) => "accessPointName_ssa_" + n2 + i, "A");
var B = "s3-object-lambda";
var C = "s3-outposts";
var D = "bucketPartition";
var E = "us-east-1";
var F = "outpostType";
var G = "name";
var H = "s3";
var I = "{url#scheme}://{Bucket}.{url#authority}{url#path}";
var J = "{url#scheme}://{url#authority}{url#path}";
var K = "{url#scheme}://{url#authority}{url#normalizedPath}{Bucket}";
var L = "https://{Bucket}.s3-accelerate.{partitionResult#dnsSuffix}";
var M = "https://{Bucket}.s3.{partitionResult#dnsSuffix}";
var N = /* @__PURE__ */ __name((n2) => "{url#scheme}://{accessPointName_ssa_" + n2 + "}-{bucketArn#accountId}.{url#authority}{url#path}", "N");
var O = /* @__PURE__ */ __name((n2) => "Invalid ARN: The access point name may only contain a-z, A-Z, 0-9 and `-`. Found: `{accessPointName_ssa_" + n2 + "}`", "O");
var P = "sigv4a";
var Q = "{url#scheme}://{url#authority}{url#normalizedPath}{uri_encoded_bucket}";
var R = "https://s3.{partitionResult#dnsSuffix}/{uri_encoded_bucket}";
var S = "https://s3.{partitionResult#dnsSuffix}";
var T = { [aw]: "UseFIPS" };
var U = { [aw]: "UseDualStack" };
var V = { [aw]: "Bucket" };
var W = { "fn": v, [ax]: [{ [aw]: k }, G] };
var X = { [aw]: u };
var Y = { [aw]: "Region" };
var Z = { [aw]: w };
var aa = { [aw]: y };
var ab = { [aw]: "accessPointName_ssa_1" };
var ac = { "fn": v, [ax]: [Z, "region"] };
var ad = { [aw]: o };
var ae = { "fn": v, [ax]: [Z, "service"] };
var af = { "fn": v, [ax]: [Z, "accountId"] };
var ag = { [ay]: "S3Express", [az]: [{ [aA]: true, [G]: "{_s3e_auth}", [aB]: "s3express", [aC]: "{Region}" }] };
var ah = { [ay]: "S3Express", [az]: [{ [aA]: true, [G]: s, [aB]: "s3express", [aC]: "{Region}" }] };
var ai = { [az]: [{ [aA]: true, [G]: P, [aB]: C, [aD]: ["*"] }, { [aA]: true, [G]: s, [aB]: C, [aC]: "{Region}" }] };
var aj = { [az]: [{ [aA]: true, [G]: s, [aB]: H, [aC]: E }] };
var ak = { [az]: [{ [aA]: true, [G]: s, [aB]: H, [aC]: "{Region}" }] };
var al = { [az]: [{ [aA]: true, [G]: s, [aB]: B, [aC]: "{bucketArn#region}" }] };
var am = { [az]: [{ [aA]: true, [G]: s, [aB]: H, [aC]: "{bucketArn#region}" }] };
var an = { [az]: [{ [aA]: true, [G]: P, [aB]: C, [aD]: ["*"] }, { [aA]: true, [G]: s, [aB]: C, [aC]: "{bucketArn#region}" }] };
var ao = { [az]: [{ [aA]: true, [G]: s, [aB]: B, [aC]: "{Region}" }] };
var ap = [Y];
var aq = [{ [aw]: "Endpoint" }];
var as = [V];
var at = [V, 0, 7, true];
var au = [Z, "resourceId[1]"];
var av = ["*"];
var _data = {
  conditions: [
    [d, ap],
    [e, [{ [aw]: "Accelerate" }, b]],
    [e, [T, b]],
    [e, [U, b]],
    [d, aq],
    [d, as],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 0, 6, b] }, i] }, "--x-s3"]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: at }, i] }, "--xa-s3"]],
    [j, ap, k],
    [h, at, l],
    [f, [{ [aw]: l }, "--op-s3"]],
    [h, [V, 8, 12, b], m],
    [h, [V, 32, 49, b], n(2)],
    [h, [V, 49, 50, b], o],
    [e, [{ [aw]: "ForcePathStyle" }, b]],
    [f, [W, "aws-cn"]],
    [p, [U, ".dualstack", i], "_s3e_ds"],
    [q, [{ [aw]: n(2) }, c]],
    [p, [T, "-fips", i], "_s3e_fips"],
    [p, [{ fn: g, [ax]: [{ [aw]: "DisableS3ExpressSessionAuth" }, c] }, s, "sigv4-s3express"], "_s3e_auth"],
    [t, [V, c]],
    ["parseURL", aq, u],
    [e, [{ fn: g, [ax]: [{ [aw]: "UseS3ExpressControlEndpoint" }, c] }, b]],
    [t, [V, b]],
    [f, [{ fn: v, [ax]: [X, "scheme"] }, "http"]],
    [q, [Y, c]],
    ["aws.parseArn", as, w],
    [v, [{ fn: "split", [ax]: [V, x, 0] }, "[-2]"], "s3expressAvailabilityZoneId"],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 0, 4, c] }, i] }, "arn:"]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 16, 18, b] }, i] }, x]],
    [e, [{ fn: v, [ax]: [X, "isIp"] }, b]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 21, 23, b] }, i] }, x]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 27, 29, b] }, i] }, x]],
    [f, [{ [aw]: m }, "beta"]],
    ["uriEncode", as, "uri_encoded_bucket"],
    [q, [Y, b]],
    [e, [{ fn: g, [ax]: [{ [aw]: "UseObjectLambdaEndpoint" }, c] }, b]],
    [v, [Z, "resourceId[0]"], y],
    [f, [aa, i]],
    [f, [aa, z]],
    [v, au, A(1)],
    [f, [ab, i]],
    [f, [ac, i]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 14, 16, b] }, i] }, x]],
    [f, [ad, "e"]],
    [f, [ad, "o"]],
    [f, [Y, "aws-global"]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 19, 21, b] }, i] }, x]],
    [f, [ae, B]],
    [e, [{ fn: g, [ax]: [{ [aw]: "DisableAccessPoints" }, c] }, b]],
    [f, [ae, C]],
    [j, [ac], D],
    [q, [ab, b]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 26, 28, b] }, i] }, x]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 15, 17, b] }, i] }, x]],
    [v, [Z, "resourceId[4]"]],
    [f, [{ fn: g, [ax]: [{ fn: h, [ax]: [V, 20, 22, b] }, i] }, x]],
    [e, [{ [aw]: "UseGlobalEndpoint" }, b]],
    [f, [Y, E]],
    [v, au, n(1)],
    [e, [{ fn: g, [ax]: [{ [aw]: "UseArnRegion" }, b] }, b]],
    [q, [{ [aw]: n(1) }, c]],
    [v, [Z, "resourceId[2]"], F],
    [f, [Y, ac]],
    [f, [{ fn: v, [ax]: [{ [aw]: D }, G] }, W]],
    [e, [{ [aw]: "DisableMultiRegionAccessPoints" }, b]],
    [q, [ac, b]],
    [f, [{ fn: v, [ax]: [Z, "partition"] }, W]],
    [f, [af, i]],
    [f, [ae, H]],
    [q, [af, c]],
    [v, [Z, "resourceId[3]"], A(2)],
    [q, [ab, c]],
    [f, [{ [aw]: F }, z]],
    [q, [{ [aw]: A(2) }, c]]
  ],
  results: [
    [a],
    [a, "Accelerate cannot be used with FIPS"],
    [a, "Cannot set dual-stack in combination with a custom endpoint."],
    [a, "A custom endpoint cannot be combined with FIPS"],
    [a, "A custom endpoint cannot be combined with S3 Accelerate"],
    [a, "Partition does not support FIPS"],
    [a, "S3Express does not support S3 Accelerate."],
    ["{url#scheme}://{url#authority}/{uri_encoded_bucket}{url#path}", ag],
    [I, ag],
    [a, "S3Express bucket name is not a valid virtual hostable name."],
    ["https://s3express-control{_s3e_fips}{_s3e_ds}.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", ah],
    ["https://{Bucket}.s3express{_s3e_fips}-{s3expressAvailabilityZoneId}{_s3e_ds}.{Region}.{partitionResult#dnsSuffix}", ag],
    [a, "Unrecognized S3Express bucket name format."],
    [J, ag],
    ["https://s3express-control{_s3e_fips}{_s3e_ds}.{Region}.{partitionResult#dnsSuffix}", ah],
    [a, "Expected a endpoint to be specified but no endpoint was found"],
    ["https://{Bucket}.ec2.{url#authority}", ai],
    ["https://{Bucket}.ec2.s3-outposts.{Region}.{partitionResult#dnsSuffix}", ai],
    ["https://{Bucket}.op-{outpostId_ssa_2}.{url#authority}", ai],
    ["https://{Bucket}.op-{outpostId_ssa_2}.s3-outposts.{Region}.{partitionResult#dnsSuffix}", ai],
    [a, 'Unrecognized hardware type: "Expected hardware type o or e but got {hardwareType}"'],
    [a, "Invalid Outposts Bucket alias - it must be a valid bucket name."],
    [a, "Invalid ARN: The outpost Id must only contain a-z, A-Z, 0-9 and `-`."],
    [a, "Custom endpoint `{Endpoint}` was not a valid URI"],
    [a, "S3 Accelerate cannot be used in this region"],
    ["https://{Bucket}.s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://{Bucket}.s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}", ak],
    ["https://{Bucket}.s3-fips.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://{Bucket}.s3-fips.{Region}.{partitionResult#dnsSuffix}", ak],
    ["https://{Bucket}.s3-accelerate.dualstack.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://{Bucket}.s3-accelerate.dualstack.{partitionResult#dnsSuffix}", ak],
    ["https://{Bucket}.s3.dualstack.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://{Bucket}.s3.dualstack.{Region}.{partitionResult#dnsSuffix}", ak],
    [K, aj],
    [I, aj],
    [K, ak],
    [I, ak],
    [L, aj],
    [L, ak],
    [M, aj],
    [M, ak],
    ["https://{Bucket}.s3.{Region}.{partitionResult#dnsSuffix}", ak],
    [a, "Invalid region: region was not a valid DNS name."],
    [a, "S3 Object Lambda does not support Dual-stack"],
    [a, "S3 Object Lambda does not support S3 Accelerate"],
    [a, "Access points are not supported for this operation"],
    [a, "Invalid configuration: region from ARN `{bucketArn#region}` does not match client region `{Region}` and UseArnRegion is `false`"],
    [a, "Invalid ARN: Missing account id"],
    [N(1), al],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-object-lambda-fips.{bucketArn#region}.{bucketPartition#dnsSuffix}", al],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-object-lambda.{bucketArn#region}.{bucketPartition#dnsSuffix}", al],
    [a, O(1)],
    [a, "Invalid ARN: The account id may only contain a-z, A-Z, 0-9 and `-`. Found: `{bucketArn#accountId}`"],
    [a, "Invalid region in ARN: `{bucketArn#region}` (invalid DNS name)"],
    [a, "Client was configured for partition `{partitionResult#name}` but ARN (`{Bucket}`) has `{bucketPartition#name}`"],
    [a, "Invalid ARN: The ARN may only contain a single resource component after `accesspoint`."],
    [a, "Invalid ARN: bucket ARN is missing a region"],
    [a, "Invalid ARN: Expected a resource of the format `accesspoint:<accesspoint name>` but no name was provided"],
    [a, "Invalid ARN: Object Lambda ARNs only support `accesspoint` arn types, but found: `{arnType}`"],
    [a, "Access Points do not support S3 Accelerate"],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-accesspoint-fips.dualstack.{bucketArn#region}.{bucketPartition#dnsSuffix}", am],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-accesspoint-fips.{bucketArn#region}.{bucketPartition#dnsSuffix}", am],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-accesspoint.dualstack.{bucketArn#region}.{bucketPartition#dnsSuffix}", am],
    [N(1), am],
    ["https://{accessPointName_ssa_1}-{bucketArn#accountId}.s3-accesspoint.{bucketArn#region}.{bucketPartition#dnsSuffix}", am],
    [a, "Invalid ARN: The ARN was not for the S3 service, found: {bucketArn#service}"],
    [a, "S3 MRAP does not support dual-stack"],
    [a, "S3 MRAP does not support FIPS"],
    [a, "S3 MRAP does not support S3 Accelerate"],
    [a, "Invalid configuration: Multi-Region Access Point ARNs are disabled."],
    ["https://{accessPointName_ssa_1}.accesspoint.s3-global.{partitionResult#dnsSuffix}", { [az]: [{ [aA]: b, name: P, [aB]: H, [aD]: av }] }],
    [a, "Client was configured for partition `{partitionResult#name}` but bucket referred to partition `{bucketArn#partition}`"],
    [a, "Invalid Access Point Name"],
    [a, "S3 Outposts does not support Dual-stack"],
    [a, "S3 Outposts does not support FIPS"],
    [a, "S3 Outposts does not support S3 Accelerate"],
    [a, "Invalid Arn: Outpost Access Point ARN contains sub resources"],
    ["https://{accessPointName_ssa_2}-{bucketArn#accountId}.{outpostId_ssa_1}.{url#authority}", an],
    ["https://{accessPointName_ssa_2}-{bucketArn#accountId}.{outpostId_ssa_1}.s3-outposts.{bucketArn#region}.{bucketPartition#dnsSuffix}", an],
    [a, O(2)],
    [a, "Expected an outpost type `accesspoint`, found {outpostType}"],
    [a, "Invalid ARN: expected an access point name"],
    [a, "Invalid ARN: Expected a 4-component resource"],
    [a, "Invalid ARN: The outpost Id may only contain a-z, A-Z, 0-9 and `-`. Found: `{outpostId_ssa_1}`"],
    [a, "Invalid ARN: The Outpost Id was not set"],
    [a, "Invalid ARN: Unrecognized format: {Bucket} (type: {arnType})"],
    [a, "Invalid ARN: No ARN type specified"],
    [a, "Invalid ARN: `{Bucket}` was not a valid ARN"],
    [a, "Path-style addressing cannot be used with ARN buckets"],
    ["https://s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", aj],
    ["https://s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", ak],
    ["https://s3-fips.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", aj],
    ["https://s3-fips.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", ak],
    ["https://s3.dualstack.us-east-1.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", aj],
    ["https://s3.dualstack.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", ak],
    [Q, aj],
    [Q, ak],
    [R, aj],
    [R, ak],
    ["https://s3.{Region}.{partitionResult#dnsSuffix}/{uri_encoded_bucket}", ak],
    [a, "Path-style addressing cannot be used with S3 Accelerate"],
    [J, ao],
    ["https://s3-object-lambda-fips.{Region}.{partitionResult#dnsSuffix}", ao],
    ["https://s3-object-lambda.{Region}.{partitionResult#dnsSuffix}", ao],
    ["https://s3-fips.dualstack.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://s3-fips.dualstack.{Region}.{partitionResult#dnsSuffix}", ak],
    ["https://s3-fips.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://s3-fips.{Region}.{partitionResult#dnsSuffix}", ak],
    ["https://s3.dualstack.us-east-1.{partitionResult#dnsSuffix}", aj],
    ["https://s3.dualstack.{Region}.{partitionResult#dnsSuffix}", ak],
    [J, aj],
    [J, ak],
    [S, aj],
    [S, ak],
    ["https://s3.{Region}.{partitionResult#dnsSuffix}", ak],
    [a, "A region must be set when sending requests to S3."]
  ]
};
var root = 2;
var r = 1e8;
var nodes = new Int32Array([
  -1,
  1,
  -1,
  0,
  3,
  r + 115,
  1,
  424,
  4,
  2,
  272,
  5,
  3,
  233,
  6,
  4,
  85,
  7,
  5,
  15,
  8,
  8,
  9,
  r + 115,
  16,
  10,
  13,
  18,
  11,
  13,
  19,
  12,
  13,
  22,
  r + 14,
  13,
  35,
  14,
  r + 42,
  36,
  r + 103,
  435,
  6,
  271,
  16,
  7,
  270,
  17,
  8,
  19,
  18,
  14,
  501,
  106,
  9,
  20,
  24,
  10,
  21,
  24,
  11,
  22,
  24,
  12,
  23,
  24,
  13,
  547,
  24,
  14,
  77,
  25,
  20,
  73,
  26,
  26,
  27,
  78,
  37,
  28,
  r + 86,
  38,
  r + 86,
  29,
  39,
  47,
  30,
  48,
  r + 58,
  31,
  50,
  32,
  r + 85,
  51,
  33,
  136,
  55,
  r + 76,
  34,
  59,
  35,
  r + 84,
  60,
  39,
  36,
  61,
  37,
  r + 83,
  62,
  38,
  146,
  63,
  41,
  r + 46,
  61,
  40,
  r + 83,
  62,
  41,
  150,
  64,
  42,
  r + 54,
  66,
  43,
  r + 53,
  70,
  44,
  r + 52,
  71,
  45,
  r + 81,
  73,
  46,
  r + 80,
  74,
  r + 78,
  r + 79,
  40,
  48,
  r + 57,
  41,
  r + 57,
  49,
  42,
  185,
  50,
  48,
  62,
  51,
  49,
  r + 45,
  52,
  51,
  53,
  526,
  60,
  56,
  54,
  62,
  r + 55,
  55,
  63,
  57,
  r + 46,
  62,
  r + 55,
  57,
  64,
  58,
  r + 54,
  66,
  59,
  r + 53,
  69,
  60,
  r + 65,
  70,
  61,
  r + 52,
  72,
  r + 64,
  r + 51,
  49,
  r + 45,
  63,
  51,
  64,
  526,
  60,
  67,
  65,
  62,
  r + 55,
  66,
  63,
  68,
  r + 46,
  62,
  r + 55,
  68,
  64,
  69,
  r + 54,
  66,
  70,
  r + 53,
  68,
  r + 47,
  71,
  70,
  72,
  r + 52,
  72,
  r + 50,
  r + 51,
  25,
  74,
  r + 42,
  46,
  r + 39,
  75,
  57,
  76,
  r + 41,
  58,
  r + 40,
  r + 41,
  26,
  r + 88,
  78,
  28,
  r + 87,
  79,
  34,
  82,
  80,
  35,
  81,
  545,
  36,
  r + 103,
  r + 115,
  46,
  r + 97,
  83,
  57,
  84,
  r + 99,
  58,
  r + 98,
  r + 99,
  5,
  101,
  86,
  8,
  87,
  r + 115,
  16,
  88,
  89,
  18,
  91,
  89,
  19,
  90,
  92,
  21,
  97,
  95,
  19,
  93,
  92,
  21,
  98,
  95,
  21,
  97,
  94,
  22,
  r + 14,
  95,
  35,
  96,
  r + 42,
  36,
  r + 103,
  r + 42,
  22,
  r + 13,
  98,
  35,
  99,
  r + 42,
  36,
  r + 101,
  100,
  46,
  r + 110,
  r + 111,
  6,
  214,
  102,
  7,
  208,
  103,
  8,
  119,
  104,
  14,
  118,
  105,
  21,
  106,
  r + 23,
  26,
  107,
  502,
  37,
  108,
  r + 86,
  38,
  r + 86,
  109,
  39,
  112,
  110,
  48,
  r + 58,
  111,
  50,
  136,
  r + 85,
  40,
  113,
  r + 57,
  41,
  r + 57,
  114,
  42,
  115,
  500,
  48,
  r + 56,
  116,
  52,
  117,
  r + 72,
  65,
  r + 69,
  r + 72,
  21,
  501,
  r + 23,
  9,
  120,
  124,
  10,
  121,
  124,
  11,
  122,
  124,
  12,
  123,
  124,
  13,
  202,
  124,
  14,
  195,
  125,
  20,
  190,
  126,
  21,
  127,
  r + 23,
  23,
  128,
  129,
  24,
  189,
  129,
  26,
  130,
  197,
  37,
  131,
  r + 86,
  38,
  r + 86,
  132,
  39,
  159,
  133,
  48,
  r + 58,
  134,
  50,
  135,
  r + 85,
  51,
  141,
  136,
  55,
  r + 76,
  137,
  59,
  138,
  r + 84,
  60,
  r + 83,
  139,
  61,
  140,
  r + 83,
  63,
  r + 83,
  r + 46,
  55,
  r + 76,
  142,
  59,
  143,
  r + 84,
  60,
  148,
  144,
  61,
  145,
  r + 83,
  62,
  147,
  146,
  63,
  150,
  r + 46,
  63,
  153,
  r + 46,
  61,
  149,
  r + 83,
  62,
  153,
  150,
  64,
  151,
  r + 54,
  66,
  152,
  r + 53,
  70,
  r + 82,
  r + 52,
  64,
  154,
  r + 54,
  66,
  155,
  r + 53,
  70,
  156,
  r + 52,
  71,
  157,
  r + 81,
  73,
  158,
  r + 80,
  74,
  r + 77,
  r + 79,
  40,
  160,
  r + 57,
  41,
  r + 57,
  161,
  42,
  185,
  162,
  48,
  174,
  163,
  49,
  r + 45,
  164,
  51,
  165,
  526,
  60,
  168,
  166,
  62,
  r + 55,
  167,
  63,
  169,
  r + 46,
  62,
  r + 55,
  169,
  64,
  170,
  r + 54,
  66,
  171,
  r + 53,
  69,
  172,
  r + 65,
  70,
  173,
  r + 52,
  72,
  r + 63,
  r + 51,
  49,
  r + 45,
  175,
  51,
  176,
  526,
  60,
  179,
  177,
  62,
  r + 55,
  178,
  63,
  180,
  r + 46,
  62,
  r + 55,
  180,
  64,
  181,
  r + 54,
  66,
  182,
  r + 53,
  68,
  r + 47,
  183,
  70,
  184,
  r + 52,
  72,
  r + 48,
  r + 51,
  48,
  r + 56,
  186,
  52,
  187,
  r + 72,
  65,
  r + 69,
  188,
  67,
  r + 70,
  r + 71,
  25,
  r + 36,
  r + 42,
  21,
  191,
  r + 23,
  25,
  192,
  r + 42,
  30,
  194,
  193,
  46,
  r + 34,
  r + 36,
  46,
  r + 33,
  r + 35,
  21,
  196,
  r + 23,
  26,
  r + 88,
  197,
  28,
  r + 87,
  198,
  34,
  201,
  199,
  35,
  200,
  545,
  36,
  r + 101,
  r + 115,
  46,
  r + 95,
  r + 96,
  17,
  203,
  r + 22,
  20,
  204,
  r + 21,
  21,
  205,
  550,
  33,
  206,
  550,
  44,
  r + 16,
  207,
  45,
  r + 18,
  r + 20,
  8,
  209,
  215,
  16,
  210,
  220,
  18,
  211,
  220,
  19,
  212,
  224,
  20,
  213,
  227,
  21,
  231,
  401,
  8,
  218,
  215,
  19,
  216,
  r + 9,
  20,
  217,
  227,
  21,
  231,
  r + 9,
  16,
  219,
  220,
  18,
  223,
  220,
  19,
  221,
  224,
  20,
  222,
  227,
  21,
  231,
  r + 12,
  19,
  226,
  224,
  20,
  225,
  r + 9,
  21,
  r + 9,
  r + 12,
  20,
  230,
  227,
  21,
  228,
  r + 9,
  30,
  229,
  r + 9,
  34,
  r + 7,
  r + 9,
  21,
  231,
  415,
  30,
  232,
  r + 8,
  34,
  r + 7,
  r + 8,
  4,
  r + 2,
  234,
  5,
  235,
  480,
  6,
  271,
  236,
  7,
  270,
  237,
  8,
  238,
  491,
  9,
  239,
  243,
  10,
  240,
  243,
  11,
  241,
  243,
  12,
  242,
  243,
  13,
  547,
  243,
  14,
  266,
  244,
  20,
  264,
  245,
  26,
  246,
  267,
  37,
  247,
  r + 86,
  38,
  r + 86,
  248,
  39,
  249,
  518,
  40,
  250,
  r + 57,
  41,
  r + 57,
  251,
  42,
  538,
  252,
  48,
  r + 43,
  253,
  49,
  r + 45,
  254,
  51,
  255,
  526,
  60,
  258,
  256,
  62,
  r + 55,
  257,
  63,
  259,
  r + 46,
  62,
  r + 55,
  259,
  64,
  260,
  r + 54,
  66,
  261,
  r + 53,
  69,
  262,
  r + 65,
  70,
  263,
  r + 52,
  72,
  r + 62,
  r + 51,
  25,
  265,
  r + 42,
  46,
  r + 31,
  r + 32,
  26,
  r + 88,
  267,
  28,
  r + 87,
  268,
  34,
  269,
  544,
  46,
  r + 93,
  r + 94,
  8,
  397,
  r + 9,
  8,
  407,
  r + 9,
  3,
  346,
  273,
  4,
  r + 3,
  274,
  5,
  284,
  275,
  8,
  276,
  r + 115,
  15,
  r + 5,
  277,
  16,
  278,
  281,
  18,
  279,
  281,
  19,
  280,
  281,
  22,
  r + 14,
  281,
  35,
  282,
  r + 42,
  36,
  r + 102,
  283,
  46,
  r + 106,
  r + 107,
  6,
  405,
  285,
  7,
  395,
  286,
  8,
  295,
  287,
  14,
  501,
  288,
  26,
  289,
  502,
  37,
  290,
  r + 86,
  38,
  r + 86,
  291,
  39,
  292,
  307,
  40,
  293,
  r + 57,
  41,
  r + 57,
  294,
  42,
  335,
  500,
  9,
  296,
  300,
  10,
  297,
  300,
  11,
  298,
  300,
  12,
  299,
  300,
  13,
  394,
  300,
  14,
  339,
  301,
  15,
  r + 5,
  302,
  20,
  337,
  303,
  26,
  304,
  341,
  37,
  305,
  r + 86,
  38,
  r + 86,
  306,
  39,
  309,
  307,
  48,
  r + 58,
  308,
  50,
  r + 74,
  r + 85,
  40,
  310,
  r + 57,
  41,
  r + 57,
  311,
  42,
  335,
  312,
  48,
  324,
  313,
  49,
  r + 45,
  314,
  51,
  315,
  526,
  60,
  318,
  316,
  62,
  r + 55,
  317,
  63,
  319,
  r + 46,
  62,
  r + 55,
  319,
  64,
  320,
  r + 54,
  66,
  321,
  r + 53,
  69,
  322,
  r + 65,
  70,
  323,
  r + 52,
  72,
  r + 61,
  r + 51,
  49,
  r + 45,
  325,
  51,
  326,
  526,
  60,
  329,
  327,
  62,
  r + 55,
  328,
  63,
  330,
  r + 46,
  62,
  r + 55,
  330,
  64,
  331,
  r + 54,
  66,
  332,
  r + 53,
  68,
  r + 47,
  333,
  70,
  334,
  r + 52,
  72,
  r + 49,
  r + 51,
  48,
  r + 56,
  336,
  52,
  r + 67,
  r + 72,
  25,
  338,
  r + 42,
  46,
  r + 27,
  r + 28,
  15,
  r + 5,
  340,
  26,
  r + 88,
  341,
  28,
  r + 87,
  342,
  34,
  345,
  343,
  35,
  344,
  545,
  36,
  r + 102,
  r + 115,
  46,
  r + 91,
  r + 92,
  4,
  r + 2,
  347,
  5,
  357,
  348,
  8,
  349,
  r + 115,
  15,
  r + 5,
  350,
  16,
  351,
  354,
  18,
  352,
  354,
  19,
  353,
  354,
  22,
  r + 14,
  354,
  35,
  355,
  r + 42,
  36,
  r + 43,
  356,
  46,
  r + 104,
  r + 105,
  6,
  405,
  358,
  7,
  395,
  359,
  8,
  360,
  491,
  9,
  361,
  365,
  10,
  362,
  365,
  11,
  363,
  365,
  12,
  364,
  365,
  13,
  394,
  365,
  14,
  389,
  366,
  15,
  r + 5,
  367,
  20,
  387,
  368,
  26,
  369,
  391,
  37,
  370,
  r + 86,
  38,
  r + 86,
  371,
  39,
  372,
  518,
  40,
  373,
  r + 57,
  41,
  r + 57,
  374,
  42,
  538,
  375,
  48,
  r + 43,
  376,
  49,
  r + 45,
  377,
  51,
  378,
  526,
  60,
  381,
  379,
  62,
  r + 55,
  380,
  63,
  382,
  r + 46,
  62,
  r + 55,
  382,
  64,
  383,
  r + 54,
  66,
  384,
  r + 53,
  69,
  385,
  r + 65,
  70,
  386,
  r + 52,
  72,
  r + 60,
  r + 51,
  25,
  388,
  r + 42,
  46,
  r + 25,
  r + 26,
  15,
  r + 5,
  390,
  26,
  r + 88,
  391,
  28,
  r + 87,
  392,
  34,
  393,
  544,
  46,
  r + 89,
  r + 90,
  15,
  r + 5,
  547,
  8,
  396,
  r + 9,
  15,
  r + 5,
  397,
  16,
  398,
  410,
  18,
  399,
  410,
  19,
  400,
  410,
  20,
  401,
  r + 9,
  27,
  402,
  r + 12,
  29,
  r + 11,
  403,
  31,
  r + 11,
  404,
  32,
  r + 11,
  422,
  8,
  406,
  r + 9,
  15,
  r + 5,
  407,
  16,
  408,
  410,
  18,
  409,
  410,
  19,
  411,
  410,
  20,
  r + 12,
  r + 9,
  20,
  414,
  412,
  22,
  413,
  r + 9,
  34,
  r + 10,
  r + 9,
  22,
  416,
  415,
  27,
  419,
  r + 12,
  27,
  418,
  417,
  34,
  r + 10,
  r + 12,
  34,
  r + 10,
  419,
  43,
  r + 11,
  420,
  47,
  r + 11,
  421,
  53,
  r + 11,
  422,
  54,
  r + 11,
  423,
  56,
  r + 11,
  r + 12,
  2,
  r + 1,
  425,
  3,
  478,
  426,
  4,
  r + 4,
  427,
  5,
  438,
  428,
  8,
  429,
  r + 115,
  16,
  430,
  433,
  18,
  431,
  433,
  19,
  432,
  433,
  22,
  r + 14,
  433,
  35,
  434,
  r + 42,
  36,
  r + 44,
  435,
  46,
  r + 112,
  436,
  57,
  437,
  r + 114,
  58,
  r + 113,
  r + 114,
  6,
  r + 6,
  439,
  7,
  r + 6,
  440,
  8,
  450,
  441,
  14,
  501,
  442,
  26,
  443,
  502,
  37,
  444,
  r + 86,
  38,
  r + 86,
  445,
  39,
  446,
  465,
  40,
  447,
  r + 57,
  41,
  r + 57,
  448,
  42,
  471,
  449,
  48,
  r + 44,
  500,
  9,
  451,
  455,
  10,
  452,
  455,
  11,
  453,
  455,
  12,
  454,
  455,
  13,
  547,
  455,
  14,
  473,
  456,
  15,
  460,
  457,
  20,
  458,
  461,
  25,
  459,
  r + 42,
  46,
  r + 37,
  r + 38,
  20,
  540,
  461,
  26,
  462,
  474,
  37,
  463,
  r + 86,
  38,
  r + 86,
  464,
  39,
  467,
  465,
  48,
  r + 58,
  466,
  50,
  r + 75,
  r + 85,
  40,
  468,
  r + 57,
  41,
  r + 57,
  469,
  42,
  471,
  470,
  48,
  r + 44,
  524,
  48,
  r + 44,
  472,
  52,
  r + 68,
  r + 72,
  26,
  r + 88,
  474,
  28,
  r + 87,
  475,
  34,
  r + 100,
  476,
  35,
  477,
  545,
  36,
  r + 44,
  r + 115,
  4,
  r + 2,
  479,
  5,
  488,
  480,
  8,
  481,
  r + 115,
  16,
  482,
  485,
  18,
  483,
  485,
  19,
  484,
  485,
  22,
  r + 14,
  485,
  35,
  486,
  r + 42,
  36,
  r + 43,
  487,
  46,
  r + 108,
  r + 109,
  6,
  r + 6,
  489,
  7,
  r + 6,
  490,
  8,
  503,
  491,
  14,
  501,
  492,
  26,
  493,
  502,
  37,
  494,
  r + 86,
  38,
  r + 86,
  495,
  39,
  496,
  518,
  40,
  497,
  r + 57,
  41,
  r + 57,
  498,
  42,
  538,
  499,
  48,
  r + 43,
  500,
  49,
  r + 45,
  526,
  26,
  r + 88,
  502,
  28,
  r + 87,
  r + 115,
  9,
  504,
  508,
  10,
  505,
  508,
  11,
  506,
  508,
  12,
  507,
  508,
  13,
  547,
  508,
  14,
  541,
  509,
  15,
  513,
  510,
  20,
  511,
  514,
  25,
  512,
  r + 42,
  46,
  r + 29,
  r + 30,
  20,
  540,
  514,
  26,
  515,
  542,
  37,
  516,
  r + 86,
  38,
  r + 86,
  517,
  39,
  520,
  518,
  48,
  r + 58,
  519,
  50,
  r + 73,
  r + 85,
  40,
  521,
  r + 57,
  41,
  r + 57,
  522,
  42,
  538,
  523,
  48,
  r + 43,
  524,
  49,
  r + 45,
  525,
  51,
  529,
  526,
  60,
  r + 55,
  527,
  62,
  r + 55,
  528,
  63,
  r + 55,
  r + 46,
  60,
  532,
  530,
  62,
  r + 55,
  531,
  63,
  533,
  r + 46,
  62,
  r + 55,
  533,
  64,
  534,
  r + 54,
  66,
  535,
  r + 53,
  69,
  536,
  r + 65,
  70,
  537,
  r + 52,
  72,
  r + 59,
  r + 51,
  48,
  r + 43,
  539,
  52,
  r + 66,
  r + 72,
  25,
  r + 24,
  r + 42,
  26,
  r + 88,
  542,
  28,
  r + 87,
  543,
  34,
  r + 100,
  544,
  35,
  546,
  545,
  36,
  r + 42,
  r + 115,
  36,
  r + 43,
  r + 115,
  17,
  548,
  r + 22,
  20,
  549,
  r + 21,
  33,
  552,
  550,
  44,
  r + 17,
  551,
  45,
  r + 19,
  r + 20,
  44,
  r + 15,
  553,
  45,
  r + 15,
  r + 20
]);
var bdd = BinaryDecisionDiagram.from(nodes, root, _data.conditions, _data.results);

// node_modules/@aws-sdk/client-s3/dist-es/endpoint/endpointResolver.js
var cache = new EndpointCache({
  size: 50,
  params: [
    "Accelerate",
    "Bucket",
    "DisableAccessPoints",
    "DisableMultiRegionAccessPoints",
    "DisableS3ExpressSessionAuth",
    "Endpoint",
    "ForcePathStyle",
    "Region",
    "UseArnRegion",
    "UseDualStack",
    "UseFIPS",
    "UseGlobalEndpoint",
    "UseObjectLambdaEndpoint",
    "UseS3ExpressControlEndpoint"
  ]
});
var defaultEndpointResolver = /* @__PURE__ */ __name((endpointParams, context = {}) => {
  return cache.get(endpointParams, () => decideEndpoint(bdd, {
    endpointParams,
    logger: context.logger
  }));
}, "defaultEndpointResolver");
customEndpointFunctions.aws = awsEndpointFunctions;

// node_modules/@aws-sdk/client-s3/dist-es/auth/httpAuthSchemeProvider.js
var createEndpointRuleSetHttpAuthSchemeParametersProvider = /* @__PURE__ */ __name((defaultHttpAuthSchemeParametersProvider) => async (config, context, input) => {
  if (!input) {
    throw new Error("Could not find `input` for `defaultEndpointRuleSetHttpAuthSchemeParametersProvider`");
  }
  const defaultParameters = await defaultHttpAuthSchemeParametersProvider(config, context, input);
  const instructionsFn = getSmithyContext(context)?.commandInstance?.constructor?.getEndpointParameterInstructions;
  if (!instructionsFn) {
    throw new Error(`getEndpointParameterInstructions() is not defined on '${context.commandName}'`);
  }
  const endpointParameters = await resolveParams(input, { getEndpointParameterInstructions: instructionsFn }, config);
  return Object.assign(defaultParameters, endpointParameters);
}, "createEndpointRuleSetHttpAuthSchemeParametersProvider");
var _defaultS3HttpAuthSchemeParametersProvider = /* @__PURE__ */ __name(async (config, context, input) => {
  return {
    operation: getSmithyContext(context).operation,
    region: await normalizeProvider(config.region)() || (() => {
      throw new Error("expected `region` to be configured for `aws.auth#sigv4`");
    })()
  };
}, "_defaultS3HttpAuthSchemeParametersProvider");
var defaultS3HttpAuthSchemeParametersProvider = createEndpointRuleSetHttpAuthSchemeParametersProvider(_defaultS3HttpAuthSchemeParametersProvider);
function createAwsAuthSigv4HttpAuthOption(authParameters) {
  return {
    schemeId: "aws.auth#sigv4",
    signingProperties: {
      name: "s3",
      region: authParameters.region
    },
    propertiesExtractor: /* @__PURE__ */ __name((config, context) => ({
      signingProperties: {
        config,
        context
      }
    }), "propertiesExtractor")
  };
}
__name(createAwsAuthSigv4HttpAuthOption, "createAwsAuthSigv4HttpAuthOption");
function createAwsAuthSigv4aHttpAuthOption(authParameters) {
  return {
    schemeId: "aws.auth#sigv4a",
    signingProperties: {
      name: "s3",
      region: authParameters.region
    },
    propertiesExtractor: /* @__PURE__ */ __name((config, context) => ({
      signingProperties: {
        config,
        context
      }
    }), "propertiesExtractor")
  };
}
__name(createAwsAuthSigv4aHttpAuthOption, "createAwsAuthSigv4aHttpAuthOption");
var createEndpointRuleSetHttpAuthSchemeProvider = /* @__PURE__ */ __name((defaultEndpointResolver2, defaultHttpAuthSchemeResolver, createHttpAuthOptionFunctions) => {
  const endpointRuleSetHttpAuthSchemeProvider = /* @__PURE__ */ __name((authParameters) => {
    const endpoint = defaultEndpointResolver2(authParameters);
    const authSchemes = endpoint.properties?.authSchemes;
    if (!authSchemes) {
      return defaultHttpAuthSchemeResolver(authParameters);
    }
    const options = [];
    for (const scheme of authSchemes) {
      const { name: resolvedName, properties = {}, ...rest } = scheme;
      const name = resolvedName.toLowerCase();
      if (resolvedName !== name) {
        console.warn(`HttpAuthScheme has been normalized with lowercasing: '${resolvedName}' to '${name}'`);
      }
      let schemeId;
      if (name === "sigv4a") {
        schemeId = "aws.auth#sigv4a";
        const sigv4Present = authSchemes.find((s2) => {
          const name2 = s2.name.toLowerCase();
          return name2 !== "sigv4a" && name2.startsWith("sigv4");
        });
        if (SignatureV4MultiRegion.sigv4aDependency() === "none" && sigv4Present) {
          continue;
        }
      } else if (name.startsWith("sigv4")) {
        schemeId = "aws.auth#sigv4";
      } else {
        throw new Error(`Unknown HttpAuthScheme found in '@smithy.rules#endpointRuleSet': '${name}'`);
      }
      const createOption = createHttpAuthOptionFunctions[schemeId];
      if (!createOption) {
        throw new Error(`Could not find HttpAuthOption create function for '${schemeId}'`);
      }
      const option = createOption(authParameters);
      option.schemeId = schemeId;
      option.signingProperties = { ...option.signingProperties || {}, ...rest, ...properties };
      options.push(option);
    }
    return options;
  }, "endpointRuleSetHttpAuthSchemeProvider");
  return endpointRuleSetHttpAuthSchemeProvider;
}, "createEndpointRuleSetHttpAuthSchemeProvider");
var _defaultS3HttpAuthSchemeProvider = /* @__PURE__ */ __name((authParameters) => {
  const options = [];
  switch (authParameters.operation) {
    default: {
      options.push(createAwsAuthSigv4HttpAuthOption(authParameters));
      options.push(createAwsAuthSigv4aHttpAuthOption(authParameters));
    }
  }
  return options;
}, "_defaultS3HttpAuthSchemeProvider");
var defaultS3HttpAuthSchemeProvider = createEndpointRuleSetHttpAuthSchemeProvider(defaultEndpointResolver, _defaultS3HttpAuthSchemeProvider, {
  "aws.auth#sigv4": createAwsAuthSigv4HttpAuthOption,
  "aws.auth#sigv4a": createAwsAuthSigv4aHttpAuthOption
});
var resolveHttpAuthSchemeConfig = /* @__PURE__ */ __name((config) => {
  const config_0 = resolveAwsSdkSigV4Config(config);
  const config_1 = resolveAwsSdkSigV4AConfig(config_0);
  return Object.assign(config_1, {
    authSchemePreference: normalizeProvider(config.authSchemePreference ?? [])
  });
}, "resolveHttpAuthSchemeConfig");

// node_modules/@aws-sdk/client-s3/dist-es/commands/CreateSessionCommand.js
init_client3();
init_index_browser();

// node_modules/@aws-sdk/client-s3/dist-es/endpoint/EndpointParameters.js
var resolveClientEndpointParameters = /* @__PURE__ */ __name((options) => {
  return Object.assign(options, {
    useFipsEndpoint: options.useFipsEndpoint ?? false,
    useDualstackEndpoint: options.useDualstackEndpoint ?? false,
    forcePathStyle: options.forcePathStyle ?? false,
    useAccelerateEndpoint: options.useAccelerateEndpoint ?? false,
    useGlobalEndpoint: options.useGlobalEndpoint ?? false,
    disableMultiregionAccessPoints: options.disableMultiregionAccessPoints ?? false,
    defaultSigningName: "s3",
    clientContextParams: options.clientContextParams ?? {}
  });
}, "resolveClientEndpointParameters");
var commonParams = {
  ForcePathStyle: { type: "clientContextParams", name: "forcePathStyle" },
  UseArnRegion: { type: "clientContextParams", name: "useArnRegion" },
  DisableMultiRegionAccessPoints: { type: "clientContextParams", name: "disableMultiregionAccessPoints" },
  Accelerate: { type: "clientContextParams", name: "useAccelerateEndpoint" },
  DisableS3ExpressSessionAuth: { type: "clientContextParams", name: "disableS3ExpressSessionAuth" },
  UseGlobalEndpoint: { type: "builtInParams", name: "useGlobalEndpoint" },
  UseFIPS: { type: "builtInParams", name: "useFipsEndpoint" },
  Endpoint: { type: "builtInParams", name: "endpoint" },
  Region: { type: "builtInParams", name: "region" },
  UseDualStack: { type: "builtInParams", name: "useDualstackEndpoint" }
};

// node_modules/@aws-sdk/client-s3/dist-es/schemas/schemas_0.js
init_schema2();

// node_modules/@aws-sdk/client-s3/dist-es/models/S3ServiceException.js
init_client3();
var S3ServiceException = class _S3ServiceException extends ServiceException {
  static {
    __name(this, "S3ServiceException");
  }
  constructor(options) {
    super(options);
    Object.setPrototypeOf(this, _S3ServiceException.prototype);
  }
};

// node_modules/@aws-sdk/client-s3/dist-es/models/errors.js
var NoSuchUpload = class _NoSuchUpload extends S3ServiceException {
  static {
    __name(this, "NoSuchUpload");
  }
  name = "NoSuchUpload";
  $fault = "client";
  constructor(opts) {
    super({
      name: "NoSuchUpload",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _NoSuchUpload.prototype);
  }
};
var AccessDenied = class _AccessDenied extends S3ServiceException {
  static {
    __name(this, "AccessDenied");
  }
  name = "AccessDenied";
  $fault = "client";
  constructor(opts) {
    super({
      name: "AccessDenied",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _AccessDenied.prototype);
  }
};
var ObjectNotInActiveTierError = class _ObjectNotInActiveTierError extends S3ServiceException {
  static {
    __name(this, "ObjectNotInActiveTierError");
  }
  name = "ObjectNotInActiveTierError";
  $fault = "client";
  constructor(opts) {
    super({
      name: "ObjectNotInActiveTierError",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _ObjectNotInActiveTierError.prototype);
  }
};
var BucketAlreadyExists = class _BucketAlreadyExists extends S3ServiceException {
  static {
    __name(this, "BucketAlreadyExists");
  }
  name = "BucketAlreadyExists";
  $fault = "client";
  constructor(opts) {
    super({
      name: "BucketAlreadyExists",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _BucketAlreadyExists.prototype);
  }
};
var BucketAlreadyOwnedByYou = class _BucketAlreadyOwnedByYou extends S3ServiceException {
  static {
    __name(this, "BucketAlreadyOwnedByYou");
  }
  name = "BucketAlreadyOwnedByYou";
  $fault = "client";
  constructor(opts) {
    super({
      name: "BucketAlreadyOwnedByYou",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _BucketAlreadyOwnedByYou.prototype);
  }
};
var NoSuchBucket = class _NoSuchBucket extends S3ServiceException {
  static {
    __name(this, "NoSuchBucket");
  }
  name = "NoSuchBucket";
  $fault = "client";
  constructor(opts) {
    super({
      name: "NoSuchBucket",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _NoSuchBucket.prototype);
  }
};
var InvalidObjectState = class _InvalidObjectState extends S3ServiceException {
  static {
    __name(this, "InvalidObjectState");
  }
  name = "InvalidObjectState";
  $fault = "client";
  StorageClass;
  AccessTier;
  constructor(opts) {
    super({
      name: "InvalidObjectState",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _InvalidObjectState.prototype);
    this.StorageClass = opts.StorageClass;
    this.AccessTier = opts.AccessTier;
  }
};
var NoSuchKey = class _NoSuchKey extends S3ServiceException {
  static {
    __name(this, "NoSuchKey");
  }
  name = "NoSuchKey";
  $fault = "client";
  constructor(opts) {
    super({
      name: "NoSuchKey",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _NoSuchKey.prototype);
  }
};
var NotFound = class _NotFound extends S3ServiceException {
  static {
    __name(this, "NotFound");
  }
  name = "NotFound";
  $fault = "client";
  constructor(opts) {
    super({
      name: "NotFound",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _NotFound.prototype);
  }
};
var EncryptionTypeMismatch = class _EncryptionTypeMismatch extends S3ServiceException {
  static {
    __name(this, "EncryptionTypeMismatch");
  }
  name = "EncryptionTypeMismatch";
  $fault = "client";
  constructor(opts) {
    super({
      name: "EncryptionTypeMismatch",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _EncryptionTypeMismatch.prototype);
  }
};
var InvalidRequest = class _InvalidRequest extends S3ServiceException {
  static {
    __name(this, "InvalidRequest");
  }
  name = "InvalidRequest";
  $fault = "client";
  constructor(opts) {
    super({
      name: "InvalidRequest",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _InvalidRequest.prototype);
  }
};
var InvalidWriteOffset = class _InvalidWriteOffset extends S3ServiceException {
  static {
    __name(this, "InvalidWriteOffset");
  }
  name = "InvalidWriteOffset";
  $fault = "client";
  constructor(opts) {
    super({
      name: "InvalidWriteOffset",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _InvalidWriteOffset.prototype);
  }
};
var TooManyParts = class _TooManyParts extends S3ServiceException {
  static {
    __name(this, "TooManyParts");
  }
  name = "TooManyParts";
  $fault = "client";
  constructor(opts) {
    super({
      name: "TooManyParts",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _TooManyParts.prototype);
  }
};
var IdempotencyParameterMismatch = class _IdempotencyParameterMismatch extends S3ServiceException {
  static {
    __name(this, "IdempotencyParameterMismatch");
  }
  name = "IdempotencyParameterMismatch";
  $fault = "client";
  constructor(opts) {
    super({
      name: "IdempotencyParameterMismatch",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _IdempotencyParameterMismatch.prototype);
  }
};
var ObjectAlreadyInActiveTierError = class _ObjectAlreadyInActiveTierError extends S3ServiceException {
  static {
    __name(this, "ObjectAlreadyInActiveTierError");
  }
  name = "ObjectAlreadyInActiveTierError";
  $fault = "client";
  constructor(opts) {
    super({
      name: "ObjectAlreadyInActiveTierError",
      $fault: "client",
      ...opts
    });
    Object.setPrototypeOf(this, _ObjectAlreadyInActiveTierError.prototype);
  }
};

// node_modules/@aws-sdk/client-s3/dist-es/schemas/schemas_0.js
var _A = "Account";
var _AAO = "AnalyticsAndOperator";
var _AC = "AccelerateConfiguration";
var _ACL = "AccessControlList";
var _ACL_ = "ACL";
var _ACLn = "AnalyticsConfigurationList";
var _ACP = "AccessControlPolicy";
var _ACT = "AccessControlTranslation";
var _ACn = "AnalyticsConfiguration";
var _AD = "AccessDenied";
var _ADb = "AbortDate";
var _AED = "AnalyticsExportDestination";
var _AF = "AnalyticsFilter";
var _AH = "AllowedHeaders";
var _AHl = "AllowedHeader";
var _AI = "AccountId";
var _AIMU = "AbortIncompleteMultipartUpload";
var _AKI = "AccessKeyId";
var _AM = "AllowedMethods";
var _AMU = "AbortMultipartUpload";
var _AMUO = "AbortMultipartUploadOutput";
var _AMUR = "AbortMultipartUploadRequest";
var _AMl = "AllowedMethod";
var _AO = "AllowedOrigins";
var _AOl = "AllowedOrigin";
var _APA = "AccessPointAlias";
var _APAc = "AccessPointArn";
var _AQRD = "AllowQuotedRecordDelimiter";
var _AR = "AcceptRanges";
var _ARI = "AbortRuleId";
var _AS = "AbacStatus";
var _ASBD = "AnalyticsS3BucketDestination";
var _ASSEBD = "ApplyServerSideEncryptionByDefault";
var _ASr = "ArchiveStatus";
var _AT = "AccessTier";
var _An = "And";
var _B = "Bucket";
var _BA = "BucketArn";
var _BAE = "BucketAlreadyExists";
var _BAI = "BucketAccountId";
var _BAOBY = "BucketAlreadyOwnedByYou";
var _BET = "BlockedEncryptionTypes";
var _BGR = "BypassGovernanceRetention";
var _BI = "BucketInfo";
var _BKE = "BucketKeyEnabled";
var _BLC = "BucketLifecycleConfiguration";
var _BLN = "BucketLocationName";
var _BLS = "BucketLoggingStatus";
var _BLT = "BucketLocationType";
var _BN = "BucketNamespace";
var _BNu = "BucketName";
var _BP = "BytesProcessed";
var _BPA = "BlockPublicAcls";
var _BPP = "BlockPublicPolicy";
var _BR = "BucketRegion";
var _BRy = "BytesReturned";
var _BS = "BytesScanned";
var _Bo = "Body";
var _Bu = "Buckets";
var _C = "Checksum";
var _CA = "ChecksumAlgorithm";
var _CACL = "CannedACL";
var _CB = "CreateBucket";
var _CBC = "CreateBucketConfiguration";
var _CBMC = "CreateBucketMetadataConfiguration";
var _CBMCR = "CreateBucketMetadataConfigurationRequest";
var _CBMTC = "CreateBucketMetadataTableConfiguration";
var _CBMTCR = "CreateBucketMetadataTableConfigurationRequest";
var _CBO = "CreateBucketOutput";
var _CBR = "CreateBucketRequest";
var _CC = "CacheControl";
var _CCRC = "ChecksumCRC32";
var _CCRCC = "ChecksumCRC32C";
var _CCRCNVME = "ChecksumCRC64NVME";
var _CC_ = "Cache-Control";
var _CD = "CreationDate";
var _CD_ = "Content-Disposition";
var _CDo = "ContentDisposition";
var _CE = "ContinuationEvent";
var _CE_ = "Content-Encoding";
var _CEo = "ContentEncoding";
var _CF = "CloudFunction";
var _CFC = "CloudFunctionConfiguration";
var _CL = "ContentLanguage";
var _CL_ = "Content-Language";
var _CL__ = "Content-Length";
var _CLo = "ContentLength";
var _CM = "Content-MD5";
var _CMD = "ChecksumMD5";
var _CMDo = "ContentMD5";
var _CMU = "CompletedMultipartUpload";
var _CMUO = "CompleteMultipartUploadOutput";
var _CMUOr = "CreateMultipartUploadOutput";
var _CMUR = "CompleteMultipartUploadResult";
var _CMURo = "CompleteMultipartUploadRequest";
var _CMURr = "CreateMultipartUploadRequest";
var _CMUo = "CompleteMultipartUpload";
var _CMUr = "CreateMultipartUpload";
var _CMh = "ChecksumMode";
var _CO = "CopyObject";
var _COO = "CopyObjectOutput";
var _COR = "CopyObjectResult";
var _CORSC = "CORSConfiguration";
var _CORSR = "CORSRules";
var _CORSRu = "CORSRule";
var _CORo = "CopyObjectRequest";
var _CP = "CommonPrefix";
var _CPL = "CommonPrefixList";
var _CPLo = "CompletedPartList";
var _CPR = "CopyPartResult";
var _CPo = "CompletedPart";
var _CPom = "CommonPrefixes";
var _CR = "ContentRange";
var _CRSBA = "ConfirmRemoveSelfBucketAccess";
var _CR_ = "Content-Range";
var _CS = "CopySource";
var _CSHA = "ChecksumSHA1";
var _CSHAh = "ChecksumSHA256";
var _CSHAhe = "ChecksumSHA512";
var _CSIM = "CopySourceIfMatch";
var _CSIMS = "CopySourceIfModifiedSince";
var _CSINM = "CopySourceIfNoneMatch";
var _CSIUS = "CopySourceIfUnmodifiedSince";
var _CSO = "CreateSessionOutput";
var _CSR = "CreateSessionResult";
var _CSRo = "CopySourceRange";
var _CSRr = "CreateSessionRequest";
var _CSSSECA = "CopySourceSSECustomerAlgorithm";
var _CSSSECK = "CopySourceSSECustomerKey";
var _CSSSECKMD = "CopySourceSSECustomerKeyMD5";
var _CSV = "CSV";
var _CSVI = "CopySourceVersionId";
var _CSVIn = "CSVInput";
var _CSVO = "CSVOutput";
var _CSo = "ConfigurationState";
var _CSr = "CreateSession";
var _CT = "ChecksumType";
var _CT_ = "Content-Type";
var _CTl = "ClientToken";
var _CTo = "ContentType";
var _CTom = "CompressionType";
var _CTon = "ContinuationToken";
var _CXXHASH = "ChecksumXXHASH64";
var _CXXHASHh = "ChecksumXXHASH3";
var _CXXHASHhe = "ChecksumXXHASH128";
var _Co = "Condition";
var _Cod = "Code";
var _Com = "Comments";
var _Con = "Contents";
var _Cont = "Cont";
var _Cr = "Credentials";
var _D = "Days";
var _DAI = "DaysAfterInitiation";
var _DB = "DeleteBucket";
var _DBAC = "DeleteBucketAnalyticsConfiguration";
var _DBACR = "DeleteBucketAnalyticsConfigurationRequest";
var _DBC = "DeleteBucketCors";
var _DBCR = "DeleteBucketCorsRequest";
var _DBE = "DeleteBucketEncryption";
var _DBER = "DeleteBucketEncryptionRequest";
var _DBIC = "DeleteBucketInventoryConfiguration";
var _DBICR = "DeleteBucketInventoryConfigurationRequest";
var _DBITC = "DeleteBucketIntelligentTieringConfiguration";
var _DBITCR = "DeleteBucketIntelligentTieringConfigurationRequest";
var _DBL = "DeleteBucketLifecycle";
var _DBLR = "DeleteBucketLifecycleRequest";
var _DBMC = "DeleteBucketMetadataConfiguration";
var _DBMCR = "DeleteBucketMetadataConfigurationRequest";
var _DBMCRe = "DeleteBucketMetricsConfigurationRequest";
var _DBMCe = "DeleteBucketMetricsConfiguration";
var _DBMTC = "DeleteBucketMetadataTableConfiguration";
var _DBMTCR = "DeleteBucketMetadataTableConfigurationRequest";
var _DBOC = "DeleteBucketOwnershipControls";
var _DBOCR = "DeleteBucketOwnershipControlsRequest";
var _DBP = "DeleteBucketPolicy";
var _DBPR = "DeleteBucketPolicyRequest";
var _DBR = "DeleteBucketRequest";
var _DBRR = "DeleteBucketReplicationRequest";
var _DBRe = "DeleteBucketReplication";
var _DBT = "DeleteBucketTagging";
var _DBTR = "DeleteBucketTaggingRequest";
var _DBW = "DeleteBucketWebsite";
var _DBWR = "DeleteBucketWebsiteRequest";
var _DE = "DataExport";
var _DIM = "DestinationIfMatch";
var _DIMS = "DestinationIfModifiedSince";
var _DINM = "DestinationIfNoneMatch";
var _DIUS = "DestinationIfUnmodifiedSince";
var _DM = "DeleteMarker";
var _DME = "DeleteMarkerEntry";
var _DMR = "DeleteMarkerReplication";
var _DMVI = "DeleteMarkerVersionId";
var _DMe = "DeleteMarkers";
var _DN = "DisplayName";
var _DO = "DeletedObject";
var _DOO = "DeleteObjectOutput";
var _DOOe = "DeleteObjectsOutput";
var _DOR = "DeleteObjectRequest";
var _DORe = "DeleteObjectsRequest";
var _DOT = "DeleteObjectTagging";
var _DOTO = "DeleteObjectTaggingOutput";
var _DOTR = "DeleteObjectTaggingRequest";
var _DOe = "DeletedObjects";
var _DOel = "DeleteObject";
var _DOele = "DeleteObjects";
var _DPAB = "DeletePublicAccessBlock";
var _DPABR = "DeletePublicAccessBlockRequest";
var _DR = "DataRedundancy";
var _DRe = "DefaultRetention";
var _DRel = "DeleteResult";
var _DRes = "DestinationResult";
var _Da = "Date";
var _De = "Delete";
var _Del = "Deleted";
var _Deli = "Delimiter";
var _Des = "Destination";
var _Desc = "Description";
var _Det = "Details";
var _E = "Expiration";
var _EA = "EmailAddress";
var _EBC = "EventBridgeConfiguration";
var _EBO = "ExpectedBucketOwner";
var _EC = "EncryptionConfiguration";
var _ECr = "ErrorCode";
var _ED = "ErrorDetails";
var _EDr = "ErrorDocument";
var _EE = "EndEvent";
var _EH = "ExposeHeaders";
var _EHx = "ExposeHeader";
var _EM = "ErrorMessage";
var _EODM = "ExpiredObjectDeleteMarker";
var _EOR = "ExistingObjectReplication";
var _ES = "ExpiresString";
var _ESBO = "ExpectedSourceBucketOwner";
var _ET = "EncryptionType";
var _ETL = "EncryptionTypeList";
var _ETM = "EncryptionTypeMismatch";
var _ETa = "ETag";
var _ETn = "EncodingType";
var _ETv = "EventThreshold";
var _ETx = "ExpressionType";
var _En = "Encryption";
var _Ena = "Enabled";
var _End = "End";
var _Er = "Errors";
var _Err = "Error";
var _Ev = "Events";
var _Eve = "Event";
var _Ex = "Expires";
var _Exp = "Expression";
var _F = "Filter";
var _FD = "FieldDelimiter";
var _FHI = "FileHeaderInfo";
var _FO = "FetchOwner";
var _FR = "FilterRule";
var _FRL = "FilterRuleList";
var _FRi = "FilterRules";
var _Fi = "Field";
var _Fo = "Format";
var _Fr = "Frequency";
var _G = "Grants";
var _GBA = "GetBucketAbac";
var _GBAC = "GetBucketAccelerateConfiguration";
var _GBACO = "GetBucketAccelerateConfigurationOutput";
var _GBACOe = "GetBucketAnalyticsConfigurationOutput";
var _GBACR = "GetBucketAccelerateConfigurationRequest";
var _GBACRe = "GetBucketAnalyticsConfigurationRequest";
var _GBACe = "GetBucketAnalyticsConfiguration";
var _GBAO = "GetBucketAbacOutput";
var _GBAOe = "GetBucketAclOutput";
var _GBAR = "GetBucketAbacRequest";
var _GBARe = "GetBucketAclRequest";
var _GBAe = "GetBucketAcl";
var _GBC = "GetBucketCors";
var _GBCO = "GetBucketCorsOutput";
var _GBCR = "GetBucketCorsRequest";
var _GBE = "GetBucketEncryption";
var _GBEO = "GetBucketEncryptionOutput";
var _GBER = "GetBucketEncryptionRequest";
var _GBIC = "GetBucketInventoryConfiguration";
var _GBICO = "GetBucketInventoryConfigurationOutput";
var _GBICR = "GetBucketInventoryConfigurationRequest";
var _GBITC = "GetBucketIntelligentTieringConfiguration";
var _GBITCO = "GetBucketIntelligentTieringConfigurationOutput";
var _GBITCR = "GetBucketIntelligentTieringConfigurationRequest";
var _GBL = "GetBucketLocation";
var _GBLC = "GetBucketLifecycleConfiguration";
var _GBLCO = "GetBucketLifecycleConfigurationOutput";
var _GBLCR = "GetBucketLifecycleConfigurationRequest";
var _GBLO = "GetBucketLocationOutput";
var _GBLOe = "GetBucketLoggingOutput";
var _GBLR = "GetBucketLocationRequest";
var _GBLRe = "GetBucketLoggingRequest";
var _GBLe = "GetBucketLogging";
var _GBMC = "GetBucketMetadataConfiguration";
var _GBMCO = "GetBucketMetadataConfigurationOutput";
var _GBMCOe = "GetBucketMetricsConfigurationOutput";
var _GBMCR = "GetBucketMetadataConfigurationResult";
var _GBMCRe = "GetBucketMetadataConfigurationRequest";
var _GBMCRet = "GetBucketMetricsConfigurationRequest";
var _GBMCe = "GetBucketMetricsConfiguration";
var _GBMTC = "GetBucketMetadataTableConfiguration";
var _GBMTCO = "GetBucketMetadataTableConfigurationOutput";
var _GBMTCR = "GetBucketMetadataTableConfigurationResult";
var _GBMTCRe = "GetBucketMetadataTableConfigurationRequest";
var _GBNC = "GetBucketNotificationConfiguration";
var _GBNCR = "GetBucketNotificationConfigurationRequest";
var _GBOC = "GetBucketOwnershipControls";
var _GBOCO = "GetBucketOwnershipControlsOutput";
var _GBOCR = "GetBucketOwnershipControlsRequest";
var _GBP = "GetBucketPolicy";
var _GBPO = "GetBucketPolicyOutput";
var _GBPR = "GetBucketPolicyRequest";
var _GBPS = "GetBucketPolicyStatus";
var _GBPSO = "GetBucketPolicyStatusOutput";
var _GBPSR = "GetBucketPolicyStatusRequest";
var _GBR = "GetBucketReplication";
var _GBRO = "GetBucketReplicationOutput";
var _GBRP = "GetBucketRequestPayment";
var _GBRPO = "GetBucketRequestPaymentOutput";
var _GBRPR = "GetBucketRequestPaymentRequest";
var _GBRR = "GetBucketReplicationRequest";
var _GBT = "GetBucketTagging";
var _GBTO = "GetBucketTaggingOutput";
var _GBTR = "GetBucketTaggingRequest";
var _GBV = "GetBucketVersioning";
var _GBVO = "GetBucketVersioningOutput";
var _GBVR = "GetBucketVersioningRequest";
var _GBW = "GetBucketWebsite";
var _GBWO = "GetBucketWebsiteOutput";
var _GBWR = "GetBucketWebsiteRequest";
var _GFC = "GrantFullControl";
var _GJP = "GlacierJobParameters";
var _GO = "GetObject";
var _GOA = "GetObjectAcl";
var _GOAO = "GetObjectAclOutput";
var _GOAOe = "GetObjectAttributesOutput";
var _GOAP = "GetObjectAttributesParts";
var _GOAR = "GetObjectAclRequest";
var _GOARe = "GetObjectAttributesResponse";
var _GOARet = "GetObjectAttributesRequest";
var _GOAe = "GetObjectAttributes";
var _GOLC = "GetObjectLockConfiguration";
var _GOLCO = "GetObjectLockConfigurationOutput";
var _GOLCR = "GetObjectLockConfigurationRequest";
var _GOLH = "GetObjectLegalHold";
var _GOLHO = "GetObjectLegalHoldOutput";
var _GOLHR = "GetObjectLegalHoldRequest";
var _GOO = "GetObjectOutput";
var _GOR = "GetObjectRequest";
var _GORO = "GetObjectRetentionOutput";
var _GORR = "GetObjectRetentionRequest";
var _GORe = "GetObjectRetention";
var _GOT = "GetObjectTagging";
var _GOTO = "GetObjectTaggingOutput";
var _GOTOe = "GetObjectTorrentOutput";
var _GOTR = "GetObjectTaggingRequest";
var _GOTRe = "GetObjectTorrentRequest";
var _GOTe = "GetObjectTorrent";
var _GPAB = "GetPublicAccessBlock";
var _GPABO = "GetPublicAccessBlockOutput";
var _GPABR = "GetPublicAccessBlockRequest";
var _GR = "GrantRead";
var _GRACP = "GrantReadACP";
var _GW = "GrantWrite";
var _GWACP = "GrantWriteACP";
var _Gr = "Grant";
var _Gra = "Grantee";
var _HB = "HeadBucket";
var _HBO = "HeadBucketOutput";
var _HBR = "HeadBucketRequest";
var _HECRE = "HttpErrorCodeReturnedEquals";
var _HN = "HostName";
var _HO = "HeadObject";
var _HOO = "HeadObjectOutput";
var _HOR = "HeadObjectRequest";
var _HRC = "HttpRedirectCode";
var _I = "Id";
var _IC = "InventoryConfiguration";
var _ICL = "InventoryConfigurationList";
var _ID = "ID";
var _IDn = "IndexDocument";
var _IDnv = "InventoryDestination";
var _IE = "IsEnabled";
var _IEn = "InventoryEncryption";
var _IF = "InventoryFilter";
var _IL = "IsLatest";
var _IM = "IfMatch";
var _IMIT = "IfMatchInitiatedTime";
var _IMLMT = "IfMatchLastModifiedTime";
var _IMS = "IfMatchSize";
var _IMS_ = "If-Modified-Since";
var _IMSf = "IfModifiedSince";
var _IMUR = "InitiateMultipartUploadResult";
var _IM_ = "If-Match";
var _INM = "IfNoneMatch";
var _INM_ = "If-None-Match";
var _IOF = "InventoryOptionalFields";
var _IOS = "InvalidObjectState";
var _IOV = "IncludedObjectVersions";
var _IP = "IsPublic";
var _IPA = "IgnorePublicAcls";
var _IPM = "IdempotencyParameterMismatch";
var _IR = "InvalidRequest";
var _IRIP = "IsRestoreInProgress";
var _IS = "InputSerialization";
var _ISBD = "InventoryS3BucketDestination";
var _ISn = "InventorySchedule";
var _IT = "IsTruncated";
var _ITAO = "IntelligentTieringAndOperator";
var _ITC = "IntelligentTieringConfiguration";
var _ITCL = "IntelligentTieringConfigurationList";
var _ITCR = "InventoryTableConfigurationResult";
var _ITCU = "InventoryTableConfigurationUpdates";
var _ITCn = "InventoryTableConfiguration";
var _ITF = "IntelligentTieringFilter";
var _IUS = "IfUnmodifiedSince";
var _IUS_ = "If-Unmodified-Since";
var _IWO = "InvalidWriteOffset";
var _In = "Initiator";
var _Ini = "Initiated";
var _JSON = "JSON";
var _JSONI = "JSONInput";
var _JSONO = "JSONOutput";
var _JTC = "JournalTableConfiguration";
var _JTCR = "JournalTableConfigurationResult";
var _JTCU = "JournalTableConfigurationUpdates";
var _K = "Key";
var _KC = "KeyCount";
var _KI = "KeyId";
var _KKA = "KmsKeyArn";
var _KM = "KeyMarker";
var _KMSC = "KMSContext";
var _KMSKA = "KMSKeyArn";
var _KMSKI = "KMSKeyId";
var _KMSMKID = "KMSMasterKeyID";
var _KPE = "KeyPrefixEquals";
var _L = "Location";
var _LAMBR = "ListAllMyBucketsResult";
var _LAMDBR = "ListAllMyDirectoryBucketsResult";
var _LB = "ListBuckets";
var _LBAC = "ListBucketAnalyticsConfigurations";
var _LBACO = "ListBucketAnalyticsConfigurationsOutput";
var _LBACR = "ListBucketAnalyticsConfigurationResult";
var _LBACRi = "ListBucketAnalyticsConfigurationsRequest";
var _LBIC = "ListBucketInventoryConfigurations";
var _LBICO = "ListBucketInventoryConfigurationsOutput";
var _LBICR = "ListBucketInventoryConfigurationsRequest";
var _LBITC = "ListBucketIntelligentTieringConfigurations";
var _LBITCO = "ListBucketIntelligentTieringConfigurationsOutput";
var _LBITCR = "ListBucketIntelligentTieringConfigurationsRequest";
var _LBMC = "ListBucketMetricsConfigurations";
var _LBMCO = "ListBucketMetricsConfigurationsOutput";
var _LBMCR = "ListBucketMetricsConfigurationsRequest";
var _LBO = "ListBucketsOutput";
var _LBR = "ListBucketsRequest";
var _LBRi = "ListBucketResult";
var _LC = "LocationConstraint";
var _LCi = "LifecycleConfiguration";
var _LDB = "ListDirectoryBuckets";
var _LDBO = "ListDirectoryBucketsOutput";
var _LDBR = "ListDirectoryBucketsRequest";
var _LE = "LoggingEnabled";
var _LEi = "LifecycleExpiration";
var _LFA = "LambdaFunctionArn";
var _LFC = "LambdaFunctionConfiguration";
var _LFCL = "LambdaFunctionConfigurationList";
var _LFCa = "LambdaFunctionConfigurations";
var _LH = "LegalHold";
var _LI = "LocationInfo";
var _LICR = "ListInventoryConfigurationsResult";
var _LM = "LastModified";
var _LMCR = "ListMetricsConfigurationsResult";
var _LMT = "LastModifiedTime";
var _LMU = "ListMultipartUploads";
var _LMUO = "ListMultipartUploadsOutput";
var _LMUR = "ListMultipartUploadsResult";
var _LMURi = "ListMultipartUploadsRequest";
var _LM_ = "Last-Modified";
var _LO = "ListObjects";
var _LOO = "ListObjectsOutput";
var _LOR = "ListObjectsRequest";
var _LOV = "ListObjectsV2";
var _LOVO = "ListObjectsV2Output";
var _LOVOi = "ListObjectVersionsOutput";
var _LOVR = "ListObjectsV2Request";
var _LOVRi = "ListObjectVersionsRequest";
var _LOVi = "ListObjectVersions";
var _LP = "ListParts";
var _LPO = "ListPartsOutput";
var _LPR = "ListPartsResult";
var _LPRi = "ListPartsRequest";
var _LR = "LifecycleRule";
var _LRAO = "LifecycleRuleAndOperator";
var _LRF = "LifecycleRuleFilter";
var _LRi = "LifecycleRules";
var _LVR = "ListVersionsResult";
var _M = "Metadata";
var _MAO = "MetricsAndOperator";
var _MAS = "MaxAgeSeconds";
var _MB = "MaxBuckets";
var _MC = "MetadataConfiguration";
var _MCL = "MetricsConfigurationList";
var _MCR = "MetadataConfigurationResult";
var _MCe = "MetricsConfiguration";
var _MD = "MetadataDirective";
var _MDB = "MaxDirectoryBuckets";
var _MDf = "MfaDelete";
var _ME = "MetadataEntry";
var _MF = "MetricsFilter";
var _MFA = "MFA";
var _MFAD = "MFADelete";
var _MK = "MaxKeys";
var _MM = "MissingMeta";
var _MOS = "MpuObjectSize";
var _MP = "MaxParts";
var _MTC = "MetadataTableConfiguration";
var _MTCR = "MetadataTableConfigurationResult";
var _MTEC = "MetadataTableEncryptionConfiguration";
var _MU = "MultipartUpload";
var _MUL = "MultipartUploadList";
var _MUa = "MaxUploads";
var _Ma = "Marker";
var _Me = "Metrics";
var _Mes = "Message";
var _Mi = "Minutes";
var _Mo = "Mode";
var _N = "Name";
var _NC = "NotificationConfiguration";
var _NCF = "NotificationConfigurationFilter";
var _NCT = "NextContinuationToken";
var _ND = "NoncurrentDays";
var _NEKKAS = "NonEmptyKmsKeyArnString";
var _NF = "NotFound";
var _NKM = "NextKeyMarker";
var _NM = "NextMarker";
var _NNV = "NewerNoncurrentVersions";
var _NPNM = "NextPartNumberMarker";
var _NSB = "NoSuchBucket";
var _NSK = "NoSuchKey";
var _NSU = "NoSuchUpload";
var _NUIM = "NextUploadIdMarker";
var _NVE = "NoncurrentVersionExpiration";
var _NVIM = "NextVersionIdMarker";
var _NVT = "NoncurrentVersionTransitions";
var _NVTL = "NoncurrentVersionTransitionList";
var _NVTo = "NoncurrentVersionTransition";
var _O = "Owner";
var _OA = "ObjectAttributes";
var _OAIATE = "ObjectAlreadyInActiveTierError";
var _OC = "OwnershipControls";
var _OCR = "OwnershipControlsRule";
var _OCRw = "OwnershipControlsRules";
var _OE = "ObjectEncryption";
var _OF = "OptionalFields";
var _OI = "ObjectIdentifier";
var _OIL = "ObjectIdentifierList";
var _OL = "OutputLocation";
var _OLC = "ObjectLockConfiguration";
var _OLE = "ObjectLockEnabled";
var _OLEFB = "ObjectLockEnabledForBucket";
var _OLLH = "ObjectLockLegalHold";
var _OLLHS = "ObjectLockLegalHoldStatus";
var _OLM = "ObjectLockMode";
var _OLR = "ObjectLockRetention";
var _OLRUD = "ObjectLockRetainUntilDate";
var _OLRb = "ObjectLockRule";
var _OLb = "ObjectList";
var _ONIATE = "ObjectNotInActiveTierError";
var _OO = "ObjectOwnership";
var _OOA = "OptionalObjectAttributes";
var _OP = "ObjectParts";
var _OPb = "ObjectPart";
var _OS = "ObjectSize";
var _OSGT = "ObjectSizeGreaterThan";
var _OSLT = "ObjectSizeLessThan";
var _OSV = "OutputSchemaVersion";
var _OSu = "OutputSerialization";
var _OV = "ObjectVersion";
var _OVL = "ObjectVersionList";
var _Ob = "Objects";
var _Obj = "Object";
var _P = "Prefix";
var _PABC = "PublicAccessBlockConfiguration";
var _PBA = "PutBucketAbac";
var _PBAC = "PutBucketAccelerateConfiguration";
var _PBACR = "PutBucketAccelerateConfigurationRequest";
var _PBACRu = "PutBucketAnalyticsConfigurationRequest";
var _PBACu = "PutBucketAnalyticsConfiguration";
var _PBAR = "PutBucketAbacRequest";
var _PBARu = "PutBucketAclRequest";
var _PBAu = "PutBucketAcl";
var _PBC = "PutBucketCors";
var _PBCR = "PutBucketCorsRequest";
var _PBE = "PutBucketEncryption";
var _PBER = "PutBucketEncryptionRequest";
var _PBIC = "PutBucketInventoryConfiguration";
var _PBICR = "PutBucketInventoryConfigurationRequest";
var _PBITC = "PutBucketIntelligentTieringConfiguration";
var _PBITCR = "PutBucketIntelligentTieringConfigurationRequest";
var _PBL = "PutBucketLogging";
var _PBLC = "PutBucketLifecycleConfiguration";
var _PBLCO = "PutBucketLifecycleConfigurationOutput";
var _PBLCR = "PutBucketLifecycleConfigurationRequest";
var _PBLR = "PutBucketLoggingRequest";
var _PBMC = "PutBucketMetricsConfiguration";
var _PBMCR = "PutBucketMetricsConfigurationRequest";
var _PBNC = "PutBucketNotificationConfiguration";
var _PBNCR = "PutBucketNotificationConfigurationRequest";
var _PBOC = "PutBucketOwnershipControls";
var _PBOCR = "PutBucketOwnershipControlsRequest";
var _PBP = "PutBucketPolicy";
var _PBPR = "PutBucketPolicyRequest";
var _PBR = "PutBucketReplication";
var _PBRP = "PutBucketRequestPayment";
var _PBRPR = "PutBucketRequestPaymentRequest";
var _PBRR = "PutBucketReplicationRequest";
var _PBT = "PutBucketTagging";
var _PBTR = "PutBucketTaggingRequest";
var _PBV = "PutBucketVersioning";
var _PBVR = "PutBucketVersioningRequest";
var _PBW = "PutBucketWebsite";
var _PBWR = "PutBucketWebsiteRequest";
var _PC = "PartsCount";
var _PDS = "PartitionDateSource";
var _PE = "ProgressEvent";
var _PI = "ParquetInput";
var _PL = "PartsList";
var _PN = "PartNumber";
var _PNM = "PartNumberMarker";
var _PO = "PutObject";
var _POA = "PutObjectAcl";
var _POAO = "PutObjectAclOutput";
var _POAR = "PutObjectAclRequest";
var _POLC = "PutObjectLockConfiguration";
var _POLCO = "PutObjectLockConfigurationOutput";
var _POLCR = "PutObjectLockConfigurationRequest";
var _POLH = "PutObjectLegalHold";
var _POLHO = "PutObjectLegalHoldOutput";
var _POLHR = "PutObjectLegalHoldRequest";
var _POO = "PutObjectOutput";
var _POR = "PutObjectRequest";
var _PORO = "PutObjectRetentionOutput";
var _PORR = "PutObjectRetentionRequest";
var _PORu = "PutObjectRetention";
var _POT = "PutObjectTagging";
var _POTO = "PutObjectTaggingOutput";
var _POTR = "PutObjectTaggingRequest";
var _PP = "PartitionedPrefix";
var _PPAB = "PutPublicAccessBlock";
var _PPABR = "PutPublicAccessBlockRequest";
var _PS = "PolicyStatus";
var _Pa = "Parts";
var _Par = "Part";
var _Parq = "Parquet";
var _Pay = "Payer";
var _Payl = "Payload";
var _Pe = "Permission";
var _Po = "Policy";
var _Pr = "Progress";
var _Pri = "Priority";
var _Pro = "Protocol";
var _Q = "Quiet";
var _QA = "QueueArn";
var _QC = "QuoteCharacter";
var _QCL = "QueueConfigurationList";
var _QCu = "QueueConfigurations";
var _QCue = "QueueConfiguration";
var _QEC = "QuoteEscapeCharacter";
var _QF = "QuoteFields";
var _Qu = "Queue";
var _R = "Rules";
var _RART = "RedirectAllRequestsTo";
var _RC = "RequestCharged";
var _RCC = "ResponseCacheControl";
var _RCD = "ResponseContentDisposition";
var _RCE = "ResponseContentEncoding";
var _RCL = "ResponseContentLanguage";
var _RCT = "ResponseContentType";
var _RCe = "ReplicationConfiguration";
var _RD = "RecordDelimiter";
var _RE = "ResponseExpires";
var _RED = "RestoreExpiryDate";
var _REe = "RecordExpiration";
var _REec = "RecordsEvent";
var _RKKID = "ReplicaKmsKeyID";
var _RKPW = "ReplaceKeyPrefixWith";
var _RKW = "ReplaceKeyWith";
var _RM = "ReplicaModifications";
var _RO = "RenameObject";
var _ROO = "RenameObjectOutput";
var _ROOe = "RestoreObjectOutput";
var _ROP = "RestoreOutputPath";
var _ROR = "RenameObjectRequest";
var _RORe = "RestoreObjectRequest";
var _ROe = "RestoreObject";
var _RP = "RequestPayer";
var _RPB = "RestrictPublicBuckets";
var _RPC = "RequestPaymentConfiguration";
var _RPe = "RequestProgress";
var _RR = "RoutingRules";
var _RRAO = "ReplicationRuleAndOperator";
var _RRF = "ReplicationRuleFilter";
var _RRe = "ReplicationRule";
var _RRep = "ReplicationRules";
var _RReq = "RequestRoute";
var _RRes = "RestoreRequest";
var _RRo = "RoutingRule";
var _RS = "ReplicationStatus";
var _RSe = "RestoreStatus";
var _RSen = "RenameSource";
var _RT = "ReplicationTime";
var _RTV = "ReplicationTimeValue";
var _RTe = "RequestToken";
var _RUD = "RetainUntilDate";
var _Ra = "Range";
var _Re = "Restore";
var _Rec = "Records";
var _Red = "Redirect";
var _Ret = "Retention";
var _Ro = "Role";
var _Ru = "Rule";
var _S = "Status";
var _SA = "StartAfter";
var _SAK = "SecretAccessKey";
var _SAs = "SseAlgorithm";
var _SB = "StreamingBlob";
var _SBD = "S3BucketDestination";
var _SC = "StorageClass";
var _SCA = "StorageClassAnalysis";
var _SCADE = "StorageClassAnalysisDataExport";
var _SCV = "SessionCredentialValue";
var _SCe = "SessionCredentials";
var _SCt = "StatusCode";
var _SDV = "SkipDestinationValidation";
var _SE = "StatsEvent";
var _SIM = "SourceIfMatch";
var _SIMS = "SourceIfModifiedSince";
var _SINM = "SourceIfNoneMatch";
var _SIUS = "SourceIfUnmodifiedSince";
var _SK = "SSE-KMS";
var _SKEO = "SseKmsEncryptedObjects";
var _SKF = "S3KeyFilter";
var _SKe = "S3Key";
var _SL = "S3Location";
var _SM = "SessionMode";
var _SOC = "SelectObjectContent";
var _SOCES = "SelectObjectContentEventStream";
var _SOCO = "SelectObjectContentOutput";
var _SOCR = "SelectObjectContentRequest";
var _SP = "SelectParameters";
var _SPi = "SimplePrefix";
var _SR = "ScanRange";
var _SS = "SSE-S3";
var _SSC = "SourceSelectionCriteria";
var _SSE = "ServerSideEncryption";
var _SSEA = "SSEAlgorithm";
var _SSEBD = "ServerSideEncryptionByDefault";
var _SSEC = "ServerSideEncryptionConfiguration";
var _SSECA = "SSECustomerAlgorithm";
var _SSECK = "SSECustomerKey";
var _SSECKMD = "SSECustomerKeyMD5";
var _SSEKMS = "SSEKMS";
var _SSEKMSE = "SSEKMSEncryption";
var _SSEKMSEC = "SSEKMSEncryptionContext";
var _SSEKMSKI = "SSEKMSKeyId";
var _SSER = "ServerSideEncryptionRule";
var _SSERe = "ServerSideEncryptionRules";
var _SSES = "SSES3";
var _ST = "SessionToken";
var _STD = "S3TablesDestination";
var _STDR = "S3TablesDestinationResult";
var _S_ = "S3";
var _Sc = "Schedule";
var _Si = "Size";
var _St = "Start";
var _Sta = "Stats";
var _Su = "Suffix";
var _T = "Tags";
var _TA = "TableArn";
var _TAo = "TopicArn";
var _TB = "TargetBucket";
var _TBA = "TableBucketArn";
var _TBT = "TableBucketType";
var _TC = "TagCount";
var _TCL = "TopicConfigurationList";
var _TCo = "TopicConfigurations";
var _TCop = "TopicConfiguration";
var _TD = "TaggingDirective";
var _TDMOS = "TransitionDefaultMinimumObjectSize";
var _TG = "TargetGrants";
var _TGa = "TargetGrant";
var _TL = "TieringList";
var _TLr = "TransitionList";
var _TMP = "TooManyParts";
var _TN = "TableNamespace";
var _TNa = "TableName";
var _TOKF = "TargetObjectKeyFormat";
var _TP = "TargetPrefix";
var _TPC = "TotalPartsCount";
var _TS = "TagSet";
var _TSa = "TableStatus";
var _Ta = "Tag";
var _Tag = "Tagging";
var _Ti = "Tier";
var _Tie = "Tierings";
var _Tier = "Tiering";
var _Tim = "Time";
var _To = "Token";
var _Top = "Topic";
var _Tr = "Transitions";
var _Tra = "Transition";
var _Ty = "Type";
var _U = "Uploads";
var _UBMITC = "UpdateBucketMetadataInventoryTableConfiguration";
var _UBMITCR = "UpdateBucketMetadataInventoryTableConfigurationRequest";
var _UBMJTC = "UpdateBucketMetadataJournalTableConfiguration";
var _UBMJTCR = "UpdateBucketMetadataJournalTableConfigurationRequest";
var _UI = "UploadId";
var _UIM = "UploadIdMarker";
var _UM = "UserMetadata";
var _UOE = "UpdateObjectEncryption";
var _UOER = "UpdateObjectEncryptionRequest";
var _UOERp = "UpdateObjectEncryptionResponse";
var _UP = "UploadPart";
var _UPC = "UploadPartCopy";
var _UPCO = "UploadPartCopyOutput";
var _UPCR = "UploadPartCopyRequest";
var _UPO = "UploadPartOutput";
var _UPR = "UploadPartRequest";
var _URI = "URI";
var _Up = "Upload";
var _V = "Value";
var _VC = "VersioningConfiguration";
var _VI = "VersionId";
var _VIM = "VersionIdMarker";
var _Ve = "Versions";
var _Ver = "Version";
var _WC = "WebsiteConfiguration";
var _WGOR = "WriteGetObjectResponse";
var _WGORR = "WriteGetObjectResponseRequest";
var _WOB = "WriteOffsetBytes";
var _WRL = "WebsiteRedirectLocation";
var _Y = "Years";
var _ar = "accept-ranges";
var _br = "bucket-region";
var _c = "client";
var _ct = "continuation-token";
var _d = "delimiter";
var _e = "error";
var _eP = "eventPayload";
var _en = "endpoint";
var _et = "encoding-type";
var _fo = "fetch-owner";
var _h = "http";
var _hC = "httpChecksum";
var _hE = "httpError";
var _hH = "httpHeader";
var _hL = "hostLabel";
var _hP = "httpPayload";
var _hPH = "httpPrefixHeaders";
var _hQ = "httpQuery";
var _hi = "http://www.w3.org/2001/XMLSchema-instance";
var _i = "id";
var _iT = "idempotencyToken";
var _km = "key-marker";
var _m = "marker";
var _mb = "max-buckets";
var _mdb = "max-directory-buckets";
var _mk = "max-keys";
var _mp = "max-parts";
var _mu = "max-uploads";
var _p = "prefix";
var _pN = "partNumber";
var _pnm = "part-number-marker";
var _rcc = "response-cache-control";
var _rcd = "response-content-disposition";
var _rce = "response-content-encoding";
var _rcl = "response-content-language";
var _rct = "response-content-type";
var _re = "response-expires";
var _s = "smithy.ts.sdk.synthetic.com.amazonaws.s3";
var _sa = "start-after";
var _st = "streaming";
var _uI = "uploadId";
var _uim = "upload-id-marker";
var _vI = "versionId";
var _vim = "version-id-marker";
var _x = "xsi";
var _xA = "xmlAttribute";
var _xF = "xmlFlattened";
var _xN = "xmlName";
var _xNm = "xmlNamespace";
var _xaa = "x-amz-acl";
var _xaad = "x-amz-abort-date";
var _xaapa = "x-amz-access-point-alias";
var _xaari = "x-amz-abort-rule-id";
var _xaas = "x-amz-archive-status";
var _xaba = "x-amz-bucket-arn";
var _xabgr = "x-amz-bypass-governance-retention";
var _xabln = "x-amz-bucket-location-name";
var _xablt = "x-amz-bucket-location-type";
var _xabn = "x-amz-bucket-namespace";
var _xabole = "x-amz-bucket-object-lock-enabled";
var _xabolt = "x-amz-bucket-object-lock-token";
var _xabr = "x-amz-bucket-region";
var _xaca = "x-amz-checksum-algorithm";
var _xacc = "x-amz-checksum-crc32";
var _xacc_ = "x-amz-checksum-crc32c";
var _xacc__ = "x-amz-checksum-crc64nvme";
var _xacm = "x-amz-checksum-md5";
var _xacm_ = "x-amz-checksum-mode";
var _xacrsba = "x-amz-confirm-remove-self-bucket-access";
var _xacs = "x-amz-checksum-sha1";
var _xacs_ = "x-amz-checksum-sha256";
var _xacs__ = "x-amz-checksum-sha512";
var _xacs___ = "x-amz-copy-source";
var _xacsim = "x-amz-copy-source-if-match";
var _xacsims = "x-amz-copy-source-if-modified-since";
var _xacsinm = "x-amz-copy-source-if-none-match";
var _xacsius = "x-amz-copy-source-if-unmodified-since";
var _xacsm = "x-amz-create-session-mode";
var _xacsr = "x-amz-copy-source-range";
var _xacssseca = "x-amz-copy-source-server-side-encryption-customer-algorithm";
var _xacssseck = "x-amz-copy-source-server-side-encryption-customer-key";
var _xacssseckM = "x-amz-copy-source-server-side-encryption-customer-key-MD5";
var _xacsvi = "x-amz-copy-source-version-id";
var _xact = "x-amz-checksum-type";
var _xact_ = "x-amz-client-token";
var _xacx = "x-amz-checksum-xxhash64";
var _xacx_ = "x-amz-checksum-xxhash3";
var _xacx__ = "x-amz-checksum-xxhash128";
var _xadm = "x-amz-delete-marker";
var _xae = "x-amz-expiration";
var _xaebo = "x-amz-expected-bucket-owner";
var _xafec = "x-amz-fwd-error-code";
var _xafem = "x-amz-fwd-error-message";
var _xafhCC = "x-amz-fwd-header-Cache-Control";
var _xafhCD = "x-amz-fwd-header-Content-Disposition";
var _xafhCE = "x-amz-fwd-header-Content-Encoding";
var _xafhCL = "x-amz-fwd-header-Content-Language";
var _xafhCR = "x-amz-fwd-header-Content-Range";
var _xafhCT = "x-amz-fwd-header-Content-Type";
var _xafhE = "x-amz-fwd-header-ETag";
var _xafhE_ = "x-amz-fwd-header-Expires";
var _xafhLM = "x-amz-fwd-header-Last-Modified";
var _xafhar = "x-amz-fwd-header-accept-ranges";
var _xafhxacc = "x-amz-fwd-header-x-amz-checksum-crc32";
var _xafhxacc_ = "x-amz-fwd-header-x-amz-checksum-crc32c";
var _xafhxacc__ = "x-amz-fwd-header-x-amz-checksum-crc64nvme";
var _xafhxacm = "x-amz-fwd-header-x-amz-checksum-md5";
var _xafhxacs = "x-amz-fwd-header-x-amz-checksum-sha1";
var _xafhxacs_ = "x-amz-fwd-header-x-amz-checksum-sha256";
var _xafhxacs__ = "x-amz-fwd-header-x-amz-checksum-sha512";
var _xafhxacx = "x-amz-fwd-header-x-amz-checksum-xxhash64";
var _xafhxacx_ = "x-amz-fwd-header-x-amz-checksum-xxhash3";
var _xafhxacx__ = "x-amz-fwd-header-x-amz-checksum-xxhash128";
var _xafhxadm = "x-amz-fwd-header-x-amz-delete-marker";
var _xafhxae = "x-amz-fwd-header-x-amz-expiration";
var _xafhxamm = "x-amz-fwd-header-x-amz-missing-meta";
var _xafhxampc = "x-amz-fwd-header-x-amz-mp-parts-count";
var _xafhxaollh = "x-amz-fwd-header-x-amz-object-lock-legal-hold";
var _xafhxaolm = "x-amz-fwd-header-x-amz-object-lock-mode";
var _xafhxaolrud = "x-amz-fwd-header-x-amz-object-lock-retain-until-date";
var _xafhxar = "x-amz-fwd-header-x-amz-restore";
var _xafhxarc = "x-amz-fwd-header-x-amz-request-charged";
var _xafhxars = "x-amz-fwd-header-x-amz-replication-status";
var _xafhxasc = "x-amz-fwd-header-x-amz-storage-class";
var _xafhxasse = "x-amz-fwd-header-x-amz-server-side-encryption";
var _xafhxasseakki = "x-amz-fwd-header-x-amz-server-side-encryption-aws-kms-key-id";
var _xafhxassebke = "x-amz-fwd-header-x-amz-server-side-encryption-bucket-key-enabled";
var _xafhxasseca = "x-amz-fwd-header-x-amz-server-side-encryption-customer-algorithm";
var _xafhxasseckM = "x-amz-fwd-header-x-amz-server-side-encryption-customer-key-MD5";
var _xafhxatc = "x-amz-fwd-header-x-amz-tagging-count";
var _xafhxavi = "x-amz-fwd-header-x-amz-version-id";
var _xafs = "x-amz-fwd-status";
var _xagfc = "x-amz-grant-full-control";
var _xagr = "x-amz-grant-read";
var _xagra = "x-amz-grant-read-acp";
var _xagw = "x-amz-grant-write";
var _xagwa = "x-amz-grant-write-acp";
var _xaimit = "x-amz-if-match-initiated-time";
var _xaimlmt = "x-amz-if-match-last-modified-time";
var _xaims = "x-amz-if-match-size";
var _xam = "x-amz-meta-";
var _xam_ = "x-amz-mfa";
var _xamd = "x-amz-metadata-directive";
var _xamm = "x-amz-missing-meta";
var _xamos = "x-amz-mp-object-size";
var _xamp = "x-amz-max-parts";
var _xampc = "x-amz-mp-parts-count";
var _xaoa = "x-amz-object-attributes";
var _xaollh = "x-amz-object-lock-legal-hold";
var _xaolm = "x-amz-object-lock-mode";
var _xaolrud = "x-amz-object-lock-retain-until-date";
var _xaoo = "x-amz-object-ownership";
var _xaooa = "x-amz-optional-object-attributes";
var _xaos = "x-amz-object-size";
var _xapnm = "x-amz-part-number-marker";
var _xar = "x-amz-restore";
var _xarc = "x-amz-request-charged";
var _xarop = "x-amz-restore-output-path";
var _xarp = "x-amz-request-payer";
var _xarr = "x-amz-request-route";
var _xars = "x-amz-replication-status";
var _xars_ = "x-amz-rename-source";
var _xarsim = "x-amz-rename-source-if-match";
var _xarsims = "x-amz-rename-source-if-modified-since";
var _xarsinm = "x-amz-rename-source-if-none-match";
var _xarsius = "x-amz-rename-source-if-unmodified-since";
var _xart = "x-amz-request-token";
var _xasc = "x-amz-storage-class";
var _xasca = "x-amz-sdk-checksum-algorithm";
var _xasdv = "x-amz-skip-destination-validation";
var _xasebo = "x-amz-source-expected-bucket-owner";
var _xasse = "x-amz-server-side-encryption";
var _xasseakki = "x-amz-server-side-encryption-aws-kms-key-id";
var _xassebke = "x-amz-server-side-encryption-bucket-key-enabled";
var _xassec = "x-amz-server-side-encryption-context";
var _xasseca = "x-amz-server-side-encryption-customer-algorithm";
var _xasseck = "x-amz-server-side-encryption-customer-key";
var _xasseckM = "x-amz-server-side-encryption-customer-key-MD5";
var _xat = "x-amz-tagging";
var _xatc = "x-amz-tagging-count";
var _xatd = "x-amz-tagging-directive";
var _xatdmos = "x-amz-transition-default-minimum-object-size";
var _xavi = "x-amz-version-id";
var _xawob = "x-amz-write-offset-bytes";
var _xawrl = "x-amz-website-redirect-location";
var _xs = "xsi:type";
var n0 = "com.amazonaws.s3";
var _s_registry = TypeRegistry.for(_s);
var S3ServiceException$ = [-3, _s, "S3ServiceException", 0, [], []];
_s_registry.registerError(S3ServiceException$, S3ServiceException);
var n0_registry = TypeRegistry.for(n0);
var AccessDenied$ = [
  -3,
  n0,
  _AD,
  { [_e]: _c, [_hE]: 403 },
  [],
  []
];
n0_registry.registerError(AccessDenied$, AccessDenied);
var BucketAlreadyExists$ = [
  -3,
  n0,
  _BAE,
  { [_e]: _c, [_hE]: 409 },
  [],
  []
];
n0_registry.registerError(BucketAlreadyExists$, BucketAlreadyExists);
var BucketAlreadyOwnedByYou$ = [
  -3,
  n0,
  _BAOBY,
  { [_e]: _c, [_hE]: 409 },
  [],
  []
];
n0_registry.registerError(BucketAlreadyOwnedByYou$, BucketAlreadyOwnedByYou);
var EncryptionTypeMismatch$ = [
  -3,
  n0,
  _ETM,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(EncryptionTypeMismatch$, EncryptionTypeMismatch);
var IdempotencyParameterMismatch$ = [
  -3,
  n0,
  _IPM,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(IdempotencyParameterMismatch$, IdempotencyParameterMismatch);
var InvalidObjectState$ = [
  -3,
  n0,
  _IOS,
  { [_e]: _c, [_hE]: 403 },
  [_SC, _AT],
  [0, 0]
];
n0_registry.registerError(InvalidObjectState$, InvalidObjectState);
var InvalidRequest$ = [
  -3,
  n0,
  _IR,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(InvalidRequest$, InvalidRequest);
var InvalidWriteOffset$ = [
  -3,
  n0,
  _IWO,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(InvalidWriteOffset$, InvalidWriteOffset);
var NoSuchBucket$ = [
  -3,
  n0,
  _NSB,
  { [_e]: _c, [_hE]: 404 },
  [],
  []
];
n0_registry.registerError(NoSuchBucket$, NoSuchBucket);
var NoSuchKey$ = [
  -3,
  n0,
  _NSK,
  { [_e]: _c, [_hE]: 404 },
  [],
  []
];
n0_registry.registerError(NoSuchKey$, NoSuchKey);
var NoSuchUpload$ = [
  -3,
  n0,
  _NSU,
  { [_e]: _c, [_hE]: 404 },
  [],
  []
];
n0_registry.registerError(NoSuchUpload$, NoSuchUpload);
var NotFound$ = [
  -3,
  n0,
  _NF,
  { [_e]: _c },
  [],
  []
];
n0_registry.registerError(NotFound$, NotFound);
var ObjectAlreadyInActiveTierError$ = [
  -3,
  n0,
  _OAIATE,
  { [_e]: _c, [_hE]: 403 },
  [],
  []
];
n0_registry.registerError(ObjectAlreadyInActiveTierError$, ObjectAlreadyInActiveTierError);
var ObjectNotInActiveTierError$ = [
  -3,
  n0,
  _ONIATE,
  { [_e]: _c, [_hE]: 403 },
  [],
  []
];
n0_registry.registerError(ObjectNotInActiveTierError$, ObjectNotInActiveTierError);
var TooManyParts$ = [
  -3,
  n0,
  _TMP,
  { [_e]: _c, [_hE]: 400 },
  [],
  []
];
n0_registry.registerError(TooManyParts$, TooManyParts);
var errorTypeRegistries = [
  _s_registry,
  n0_registry
];
var CopySourceSSECustomerKey = [0, n0, _CSSSECK, 8, 0];
var NonEmptyKmsKeyArnString = [0, n0, _NEKKAS, 8, 0];
var SessionCredentialValue = [0, n0, _SCV, 8, 0];
var SSECustomerKey = [0, n0, _SSECK, 8, 0];
var SSEKMSEncryptionContext = [0, n0, _SSEKMSEC, 8, 0];
var SSEKMSKeyId = [0, n0, _SSEKMSKI, 8, 0];
var StreamingBlob = [0, n0, _SB, { [_st]: 1 }, 42];
var AbacStatus$ = [
  3,
  n0,
  _AS,
  0,
  [_S],
  [0]
];
var AbortIncompleteMultipartUpload$ = [
  3,
  n0,
  _AIMU,
  0,
  [_DAI],
  [1]
];
var AbortMultipartUploadOutput$ = [
  3,
  n0,
  _AMUO,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var AbortMultipartUploadRequest$ = [
  3,
  n0,
  _AMUR,
  0,
  [_B, _K, _UI, _RP, _EBO, _IMIT],
  [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [6, { [_hH]: _xaimit }]],
  3
];
var AccelerateConfiguration$ = [
  3,
  n0,
  _AC,
  0,
  [_S],
  [0]
];
var AccessControlPolicy$ = [
  3,
  n0,
  _ACP,
  0,
  [_G, _O],
  [[() => Grants, { [_xN]: _ACL }], () => Owner$]
];
var AccessControlTranslation$ = [
  3,
  n0,
  _ACT,
  0,
  [_O],
  [0],
  1
];
var AnalyticsAndOperator$ = [
  3,
  n0,
  _AAO,
  0,
  [_P, _T],
  [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var AnalyticsConfiguration$ = [
  3,
  n0,
  _ACn,
  0,
  [_I, _SCA, _F],
  [0, () => StorageClassAnalysis$, [() => AnalyticsFilter$, 0]],
  2
];
var AnalyticsExportDestination$ = [
  3,
  n0,
  _AED,
  0,
  [_SBD],
  [() => AnalyticsS3BucketDestination$],
  1
];
var AnalyticsS3BucketDestination$ = [
  3,
  n0,
  _ASBD,
  0,
  [_Fo, _B, _BAI, _P],
  [0, 0, 0, 0],
  2
];
var BlockedEncryptionTypes$ = [
  3,
  n0,
  _BET,
  0,
  [_ET],
  [[() => EncryptionTypeList, { [_xF]: 1 }]]
];
var Bucket$ = [
  3,
  n0,
  _B,
  0,
  [_N, _CD, _BR, _BA],
  [0, 4, 0, 0]
];
var BucketInfo$ = [
  3,
  n0,
  _BI,
  0,
  [_DR, _Ty],
  [0, 0]
];
var BucketLifecycleConfiguration$ = [
  3,
  n0,
  _BLC,
  0,
  [_R],
  [[() => LifecycleRules, { [_xF]: 1, [_xN]: _Ru }]],
  1
];
var BucketLoggingStatus$ = [
  3,
  n0,
  _BLS,
  0,
  [_LE],
  [[() => LoggingEnabled$, 0]]
];
var Checksum$ = [
  3,
  n0,
  _C,
  0,
  [_CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
var CommonPrefix$ = [
  3,
  n0,
  _CP,
  0,
  [_P],
  [0]
];
var CompletedMultipartUpload$ = [
  3,
  n0,
  _CMU,
  0,
  [_Pa],
  [[() => CompletedPartList, { [_xF]: 1, [_xN]: _Par }]]
];
var CompletedPart$ = [
  3,
  n0,
  _CPo,
  0,
  [_ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _PN],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
];
var CompleteMultipartUploadOutput$ = [
  3,
  n0,
  _CMUO,
  { [_xN]: _CMUR },
  [_L, _B, _K, _E, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT, _SSE, _VI, _SSEKMSKI, _BKE, _RC],
  [0, 0, 0, [0, { [_hH]: _xae }], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, [0, { [_hH]: _xasse }], [0, { [_hH]: _xavi }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var CompleteMultipartUploadRequest$ = [
  3,
  n0,
  _CMURo,
  0,
  [_B, _K, _UI, _MU, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT, _MOS, _RP, _EBO, _IM, _INM, _SSECA, _SSECK, _SSECKMD],
  [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [() => CompletedMultipartUpload$, { [_hP]: 1, [_xN]: _CMUo }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xact }], [1, { [_hH]: _xamos }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }]],
  3
];
var Condition$ = [
  3,
  n0,
  _Co,
  0,
  [_HECRE, _KPE],
  [0, 0]
];
var ContinuationEvent$ = [
  3,
  n0,
  _CE,
  0,
  [],
  []
];
var CopyObjectOutput$ = [
  3,
  n0,
  _COO,
  0,
  [_COR, _E, _CSVI, _VI, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RC],
  [[() => CopyObjectResult$, 16], [0, { [_hH]: _xae }], [0, { [_hH]: _xacsvi }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var CopyObjectRequest$ = [
  3,
  n0,
  _CORo,
  0,
  [_B, _CS, _K, _ACL_, _CC, _CA, _CDo, _CEo, _CL, _CTo, _CSIM, _CSIMS, _CSINM, _CSIUS, _Ex, _GFC, _GR, _GRACP, _GWACP, _IM, _INM, _M, _MD, _TD, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _CSSSECA, _CSSSECK, _CSSSECKMD, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO, _ESBO],
  [[0, 1], [0, { [_hH]: _xacs___ }], [0, 1], [0, { [_hH]: _xaa }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _xaca }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _xacsim }], [4, { [_hH]: _xacsims }], [0, { [_hH]: _xacsinm }], [4, { [_hH]: _xacsius }], [4, { [_hH]: _Ex }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xamd }], [0, { [_hH]: _xatd }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xacssseca }], [() => CopySourceSSECustomerKey, { [_hH]: _xacssseck }], [0, { [_hH]: _xacssseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasebo }]],
  3
];
var CopyObjectResult$ = [
  3,
  n0,
  _COR,
  0,
  [_ETa, _LM, _CT, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe],
  [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
var CopyPartResult$ = [
  3,
  n0,
  _CPR,
  0,
  [_ETa, _LM, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe],
  [0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
var CORSConfiguration$ = [
  3,
  n0,
  _CORSC,
  0,
  [_CORSR],
  [[() => CORSRules, { [_xF]: 1, [_xN]: _CORSRu }]],
  1
];
var CORSRule$ = [
  3,
  n0,
  _CORSRu,
  0,
  [_AM, _AO, _ID, _AH, _EH, _MAS],
  [[64 | 0, { [_xF]: 1, [_xN]: _AMl }], [64 | 0, { [_xF]: 1, [_xN]: _AOl }], 0, [64 | 0, { [_xF]: 1, [_xN]: _AHl }], [64 | 0, { [_xF]: 1, [_xN]: _EHx }], 1],
  2
];
var CreateBucketConfiguration$ = [
  3,
  n0,
  _CBC,
  0,
  [_LC, _L, _B, _T],
  [0, () => LocationInfo$, () => BucketInfo$, [() => TagSet, 0]]
];
var CreateBucketMetadataConfigurationRequest$ = [
  3,
  n0,
  _CBMCR,
  0,
  [_B, _MC, _CMDo, _CA, _EBO],
  [[0, 1], [() => MetadataConfiguration$, { [_hP]: 1, [_xN]: _MC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var CreateBucketMetadataTableConfigurationRequest$ = [
  3,
  n0,
  _CBMTCR,
  0,
  [_B, _MTC, _CMDo, _CA, _EBO],
  [[0, 1], [() => MetadataTableConfiguration$, { [_hP]: 1, [_xN]: _MTC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var CreateBucketOutput$ = [
  3,
  n0,
  _CBO,
  0,
  [_L, _BA],
  [[0, { [_hH]: _L }], [0, { [_hH]: _xaba }]]
];
var CreateBucketRequest$ = [
  3,
  n0,
  _CBR,
  0,
  [_B, _ACL_, _CBC, _GFC, _GR, _GRACP, _GW, _GWACP, _OLEFB, _OO, _BN],
  [[0, 1], [0, { [_hH]: _xaa }], [() => CreateBucketConfiguration$, { [_hP]: 1, [_xN]: _CBC }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [2, { [_hH]: _xabole }], [0, { [_hH]: _xaoo }], [0, { [_hH]: _xabn }]],
  1
];
var CreateMultipartUploadOutput$ = [
  3,
  n0,
  _CMUOr,
  { [_xN]: _IMUR },
  [_ADb, _ARI, _B, _K, _UI, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RC, _CA, _CT],
  [[4, { [_hH]: _xaad }], [0, { [_hH]: _xaari }], [0, { [_xN]: _B }], 0, 0, [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xaca }], [0, { [_hH]: _xact }]]
];
var CreateMultipartUploadRequest$ = [
  3,
  n0,
  _CMURr,
  0,
  [_B, _K, _ACL_, _CC, _CDo, _CEo, _CL, _CTo, _Ex, _GFC, _GR, _GRACP, _GWACP, _M, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO, _CA, _CT],
  [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xaca }], [0, { [_hH]: _xact }]],
  2
];
var CreateSessionOutput$ = [
  3,
  n0,
  _CSO,
  { [_xN]: _CSR },
  [_Cr, _SSE, _SSEKMSKI, _SSEKMSEC, _BKE],
  [[() => SessionCredentials$, { [_xN]: _Cr }], [0, { [_hH]: _xasse }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }]],
  1
];
var CreateSessionRequest$ = [
  3,
  n0,
  _CSRr,
  0,
  [_B, _SM, _SSE, _SSEKMSKI, _SSEKMSEC, _BKE],
  [[0, 1], [0, { [_hH]: _xacsm }], [0, { [_hH]: _xasse }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }]],
  1
];
var CSVInput$ = [
  3,
  n0,
  _CSVIn,
  0,
  [_FHI, _Com, _QEC, _RD, _FD, _QC, _AQRD],
  [0, 0, 0, 0, 0, 0, 2]
];
var CSVOutput$ = [
  3,
  n0,
  _CSVO,
  0,
  [_QF, _QEC, _RD, _FD, _QC],
  [0, 0, 0, 0, 0]
];
var DefaultRetention$ = [
  3,
  n0,
  _DRe,
  0,
  [_Mo, _D, _Y],
  [0, 1, 1]
];
var Delete$ = [
  3,
  n0,
  _De,
  0,
  [_Ob, _Q],
  [[() => ObjectIdentifierList, { [_xF]: 1, [_xN]: _Obj }], 2],
  1
];
var DeleteBucketAnalyticsConfigurationRequest$ = [
  3,
  n0,
  _DBACR,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var DeleteBucketCorsRequest$ = [
  3,
  n0,
  _DBCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketEncryptionRequest$ = [
  3,
  n0,
  _DBER,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketIntelligentTieringConfigurationRequest$ = [
  3,
  n0,
  _DBITCR,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var DeleteBucketInventoryConfigurationRequest$ = [
  3,
  n0,
  _DBICR,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var DeleteBucketLifecycleRequest$ = [
  3,
  n0,
  _DBLR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketMetadataConfigurationRequest$ = [
  3,
  n0,
  _DBMCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketMetadataTableConfigurationRequest$ = [
  3,
  n0,
  _DBMTCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketMetricsConfigurationRequest$ = [
  3,
  n0,
  _DBMCRe,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var DeleteBucketOwnershipControlsRequest$ = [
  3,
  n0,
  _DBOCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketPolicyRequest$ = [
  3,
  n0,
  _DBPR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketReplicationRequest$ = [
  3,
  n0,
  _DBRR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketRequest$ = [
  3,
  n0,
  _DBR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketTaggingRequest$ = [
  3,
  n0,
  _DBTR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeleteBucketWebsiteRequest$ = [
  3,
  n0,
  _DBWR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var DeletedObject$ = [
  3,
  n0,
  _DO,
  0,
  [_K, _VI, _DM, _DMVI],
  [0, 0, 2, 0]
];
var DeleteMarkerEntry$ = [
  3,
  n0,
  _DME,
  0,
  [_O, _K, _VI, _IL, _LM],
  [() => Owner$, 0, 0, 2, 4]
];
var DeleteMarkerReplication$ = [
  3,
  n0,
  _DMR,
  0,
  [_S],
  [0]
];
var DeleteObjectOutput$ = [
  3,
  n0,
  _DOO,
  0,
  [_DM, _VI, _RC],
  [[2, { [_hH]: _xadm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xarc }]]
];
var DeleteObjectRequest$ = [
  3,
  n0,
  _DOR,
  0,
  [_B, _K, _MFA, _VI, _RP, _BGR, _EBO, _IM, _IMLMT, _IMS],
  [[0, 1], [0, 1], [0, { [_hH]: _xam_ }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _IM_ }], [6, { [_hH]: _xaimlmt }], [1, { [_hH]: _xaims }]],
  2
];
var DeleteObjectsOutput$ = [
  3,
  n0,
  _DOOe,
  { [_xN]: _DRel },
  [_Del, _RC, _Er],
  [[() => DeletedObjects, { [_xF]: 1 }], [0, { [_hH]: _xarc }], [() => Errors, { [_xF]: 1, [_xN]: _Err }]]
];
var DeleteObjectsRequest$ = [
  3,
  n0,
  _DORe,
  0,
  [_B, _De, _MFA, _RP, _BGR, _EBO, _CA],
  [[0, 1], [() => Delete$, { [_hP]: 1, [_xN]: _De }], [0, { [_hH]: _xam_ }], [0, { [_hH]: _xarp }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]],
  2
];
var DeleteObjectTaggingOutput$ = [
  3,
  n0,
  _DOTO,
  0,
  [_VI],
  [[0, { [_hH]: _xavi }]]
];
var DeleteObjectTaggingRequest$ = [
  3,
  n0,
  _DOTR,
  0,
  [_B, _K, _VI, _EBO],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }]],
  2
];
var DeletePublicAccessBlockRequest$ = [
  3,
  n0,
  _DPABR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var Destination$ = [
  3,
  n0,
  _Des,
  0,
  [_B, _A, _SC, _ACT, _EC, _RT, _Me],
  [0, 0, 0, () => AccessControlTranslation$, () => EncryptionConfiguration$, () => ReplicationTime$, () => Metrics$],
  1
];
var DestinationResult$ = [
  3,
  n0,
  _DRes,
  0,
  [_TBT, _TBA, _TN],
  [0, 0, 0]
];
var Encryption$ = [
  3,
  n0,
  _En,
  0,
  [_ET, _KMSKI, _KMSC],
  [0, [() => SSEKMSKeyId, 0], 0],
  1
];
var EncryptionConfiguration$ = [
  3,
  n0,
  _EC,
  0,
  [_RKKID],
  [0]
];
var EndEvent$ = [
  3,
  n0,
  _EE,
  0,
  [],
  []
];
var _Error$ = [
  3,
  n0,
  _Err,
  0,
  [_K, _VI, _Cod, _Mes],
  [0, 0, 0, 0]
];
var ErrorDetails$ = [
  3,
  n0,
  _ED,
  0,
  [_ECr, _EM],
  [0, 0]
];
var ErrorDocument$ = [
  3,
  n0,
  _EDr,
  0,
  [_K],
  [0],
  1
];
var EventBridgeConfiguration$ = [
  3,
  n0,
  _EBC,
  0,
  [],
  []
];
var ExistingObjectReplication$ = [
  3,
  n0,
  _EOR,
  0,
  [_S],
  [0],
  1
];
var FilterRule$ = [
  3,
  n0,
  _FR,
  0,
  [_N, _V],
  [0, 0]
];
var GetBucketAbacOutput$ = [
  3,
  n0,
  _GBAO,
  0,
  [_AS],
  [[() => AbacStatus$, 16]]
];
var GetBucketAbacRequest$ = [
  3,
  n0,
  _GBAR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketAccelerateConfigurationOutput$ = [
  3,
  n0,
  _GBACO,
  { [_xN]: _AC },
  [_S, _RC],
  [0, [0, { [_hH]: _xarc }]]
];
var GetBucketAccelerateConfigurationRequest$ = [
  3,
  n0,
  _GBACR,
  0,
  [_B, _EBO, _RP],
  [[0, 1], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]],
  1
];
var GetBucketAclOutput$ = [
  3,
  n0,
  _GBAOe,
  { [_xN]: _ACP },
  [_O, _G],
  [() => Owner$, [() => Grants, { [_xN]: _ACL }]]
];
var GetBucketAclRequest$ = [
  3,
  n0,
  _GBARe,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketAnalyticsConfigurationOutput$ = [
  3,
  n0,
  _GBACOe,
  0,
  [_ACn],
  [[() => AnalyticsConfiguration$, 16]]
];
var GetBucketAnalyticsConfigurationRequest$ = [
  3,
  n0,
  _GBACRe,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var GetBucketCorsOutput$ = [
  3,
  n0,
  _GBCO,
  { [_xN]: _CORSC },
  [_CORSR],
  [[() => CORSRules, { [_xF]: 1, [_xN]: _CORSRu }]]
];
var GetBucketCorsRequest$ = [
  3,
  n0,
  _GBCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketEncryptionOutput$ = [
  3,
  n0,
  _GBEO,
  0,
  [_SSEC],
  [[() => ServerSideEncryptionConfiguration$, 16]]
];
var GetBucketEncryptionRequest$ = [
  3,
  n0,
  _GBER,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketIntelligentTieringConfigurationOutput$ = [
  3,
  n0,
  _GBITCO,
  0,
  [_ITC],
  [[() => IntelligentTieringConfiguration$, 16]]
];
var GetBucketIntelligentTieringConfigurationRequest$ = [
  3,
  n0,
  _GBITCR,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var GetBucketInventoryConfigurationOutput$ = [
  3,
  n0,
  _GBICO,
  0,
  [_IC],
  [[() => InventoryConfiguration$, 16]]
];
var GetBucketInventoryConfigurationRequest$ = [
  3,
  n0,
  _GBICR,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var GetBucketLifecycleConfigurationOutput$ = [
  3,
  n0,
  _GBLCO,
  { [_xN]: _LCi },
  [_R, _TDMOS],
  [[() => LifecycleRules, { [_xF]: 1, [_xN]: _Ru }], [0, { [_hH]: _xatdmos }]]
];
var GetBucketLifecycleConfigurationRequest$ = [
  3,
  n0,
  _GBLCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketLocationOutput$ = [
  3,
  n0,
  _GBLO,
  { [_xN]: _LC },
  [_LC],
  [0]
];
var GetBucketLocationRequest$ = [
  3,
  n0,
  _GBLR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketLoggingOutput$ = [
  3,
  n0,
  _GBLOe,
  { [_xN]: _BLS },
  [_LE],
  [[() => LoggingEnabled$, 0]]
];
var GetBucketLoggingRequest$ = [
  3,
  n0,
  _GBLRe,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketMetadataConfigurationOutput$ = [
  3,
  n0,
  _GBMCO,
  0,
  [_GBMCR],
  [[() => GetBucketMetadataConfigurationResult$, 16]]
];
var GetBucketMetadataConfigurationRequest$ = [
  3,
  n0,
  _GBMCRe,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketMetadataConfigurationResult$ = [
  3,
  n0,
  _GBMCR,
  0,
  [_MCR],
  [() => MetadataConfigurationResult$],
  1
];
var GetBucketMetadataTableConfigurationOutput$ = [
  3,
  n0,
  _GBMTCO,
  0,
  [_GBMTCR],
  [[() => GetBucketMetadataTableConfigurationResult$, 16]]
];
var GetBucketMetadataTableConfigurationRequest$ = [
  3,
  n0,
  _GBMTCRe,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketMetadataTableConfigurationResult$ = [
  3,
  n0,
  _GBMTCR,
  0,
  [_MTCR, _S, _Err],
  [() => MetadataTableConfigurationResult$, 0, () => ErrorDetails$],
  2
];
var GetBucketMetricsConfigurationOutput$ = [
  3,
  n0,
  _GBMCOe,
  0,
  [_MCe],
  [[() => MetricsConfiguration$, 16]]
];
var GetBucketMetricsConfigurationRequest$ = [
  3,
  n0,
  _GBMCRet,
  0,
  [_B, _I, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [0, { [_hH]: _xaebo }]],
  2
];
var GetBucketNotificationConfigurationRequest$ = [
  3,
  n0,
  _GBNCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketOwnershipControlsOutput$ = [
  3,
  n0,
  _GBOCO,
  0,
  [_OC],
  [[() => OwnershipControls$, 16]]
];
var GetBucketOwnershipControlsRequest$ = [
  3,
  n0,
  _GBOCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketPolicyOutput$ = [
  3,
  n0,
  _GBPO,
  0,
  [_Po],
  [[0, 16]]
];
var GetBucketPolicyRequest$ = [
  3,
  n0,
  _GBPR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketPolicyStatusOutput$ = [
  3,
  n0,
  _GBPSO,
  0,
  [_PS],
  [[() => PolicyStatus$, 16]]
];
var GetBucketPolicyStatusRequest$ = [
  3,
  n0,
  _GBPSR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketReplicationOutput$ = [
  3,
  n0,
  _GBRO,
  0,
  [_RCe],
  [[() => ReplicationConfiguration$, 16]]
];
var GetBucketReplicationRequest$ = [
  3,
  n0,
  _GBRR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketRequestPaymentOutput$ = [
  3,
  n0,
  _GBRPO,
  { [_xN]: _RPC },
  [_Pay],
  [0]
];
var GetBucketRequestPaymentRequest$ = [
  3,
  n0,
  _GBRPR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketTaggingOutput$ = [
  3,
  n0,
  _GBTO,
  { [_xN]: _Tag },
  [_TS],
  [[() => TagSet, 0]],
  1
];
var GetBucketTaggingRequest$ = [
  3,
  n0,
  _GBTR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketVersioningOutput$ = [
  3,
  n0,
  _GBVO,
  { [_xN]: _VC },
  [_S, _MFAD],
  [0, [0, { [_xN]: _MDf }]]
];
var GetBucketVersioningRequest$ = [
  3,
  n0,
  _GBVR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetBucketWebsiteOutput$ = [
  3,
  n0,
  _GBWO,
  { [_xN]: _WC },
  [_RART, _IDn, _EDr, _RR],
  [() => RedirectAllRequestsTo$, () => IndexDocument$, () => ErrorDocument$, [() => RoutingRules, 0]]
];
var GetBucketWebsiteRequest$ = [
  3,
  n0,
  _GBWR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetObjectAclOutput$ = [
  3,
  n0,
  _GOAO,
  { [_xN]: _ACP },
  [_O, _G, _RC],
  [() => Owner$, [() => Grants, { [_xN]: _ACL }], [0, { [_hH]: _xarc }]]
];
var GetObjectAclRequest$ = [
  3,
  n0,
  _GOAR,
  0,
  [_B, _K, _VI, _RP, _EBO],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  2
];
var GetObjectAttributesOutput$ = [
  3,
  n0,
  _GOAOe,
  { [_xN]: _GOARe },
  [_DM, _LM, _VI, _RC, _ETa, _C, _OP, _SC, _OS],
  [[2, { [_hH]: _xadm }], [4, { [_hH]: _LM_ }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xarc }], 0, () => Checksum$, [() => GetObjectAttributesParts$, 0], 0, 1]
];
var GetObjectAttributesParts$ = [
  3,
  n0,
  _GOAP,
  0,
  [_TPC, _PNM, _NPNM, _MP, _IT, _Pa],
  [[1, { [_xN]: _PC }], 0, 0, 1, 2, [() => PartsList, { [_xF]: 1, [_xN]: _Par }]]
];
var GetObjectAttributesRequest$ = [
  3,
  n0,
  _GOARet,
  0,
  [_B, _K, _OA, _VI, _MP, _PNM, _SSECA, _SSECK, _SSECKMD, _RP, _EBO],
  [[0, 1], [0, 1], [64 | 0, { [_hH]: _xaoa }], [0, { [_hQ]: _vI }], [1, { [_hH]: _xamp }], [0, { [_hH]: _xapnm }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  3
];
var GetObjectLegalHoldOutput$ = [
  3,
  n0,
  _GOLHO,
  0,
  [_LH],
  [[() => ObjectLockLegalHold$, { [_hP]: 1, [_xN]: _LH }]]
];
var GetObjectLegalHoldRequest$ = [
  3,
  n0,
  _GOLHR,
  0,
  [_B, _K, _VI, _RP, _EBO],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  2
];
var GetObjectLockConfigurationOutput$ = [
  3,
  n0,
  _GOLCO,
  0,
  [_OLC],
  [[() => ObjectLockConfiguration$, 16]]
];
var GetObjectLockConfigurationRequest$ = [
  3,
  n0,
  _GOLCR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GetObjectOutput$ = [
  3,
  n0,
  _GOO,
  0,
  [_Bo, _DM, _AR, _E, _Re, _LM, _CLo, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT, _MM, _VI, _CC, _CDo, _CEo, _CL, _CR, _CTo, _Ex, _ES, _WRL, _SSE, _M, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _SC, _RC, _RS, _PC, _TC, _OLM, _OLRUD, _OLLHS],
  [[() => StreamingBlob, 16], [2, { [_hH]: _xadm }], [0, { [_hH]: _ar }], [0, { [_hH]: _xae }], [0, { [_hH]: _xar }], [4, { [_hH]: _LM_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xact }], [1, { [_hH]: _xamm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CR_ }], [0, { [_hH]: _CT_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _ES }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasse }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xars }], [1, { [_hH]: _xampc }], [1, { [_hH]: _xatc }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }]]
];
var GetObjectRequest$ = [
  3,
  n0,
  _GOR,
  0,
  [_B, _K, _IM, _IMSf, _INM, _IUS, _Ra, _RCC, _RCD, _RCE, _RCL, _RCT, _RE, _VI, _SSECA, _SSECK, _SSECKMD, _RP, _PN, _EBO, _CMh],
  [[0, 1], [0, 1], [0, { [_hH]: _IM_ }], [4, { [_hH]: _IMS_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _Ra }], [0, { [_hQ]: _rcc }], [0, { [_hQ]: _rcd }], [0, { [_hQ]: _rce }], [0, { [_hQ]: _rcl }], [0, { [_hQ]: _rct }], [6, { [_hQ]: _re }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [1, { [_hQ]: _pN }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xacm_ }]],
  2
];
var GetObjectRetentionOutput$ = [
  3,
  n0,
  _GORO,
  0,
  [_Ret],
  [[() => ObjectLockRetention$, { [_hP]: 1, [_xN]: _Ret }]]
];
var GetObjectRetentionRequest$ = [
  3,
  n0,
  _GORR,
  0,
  [_B, _K, _VI, _RP, _EBO],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  2
];
var GetObjectTaggingOutput$ = [
  3,
  n0,
  _GOTO,
  { [_xN]: _Tag },
  [_TS, _VI],
  [[() => TagSet, 0], [0, { [_hH]: _xavi }]],
  1
];
var GetObjectTaggingRequest$ = [
  3,
  n0,
  _GOTR,
  0,
  [_B, _K, _VI, _EBO, _RP],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]],
  2
];
var GetObjectTorrentOutput$ = [
  3,
  n0,
  _GOTOe,
  0,
  [_Bo, _RC],
  [[() => StreamingBlob, 16], [0, { [_hH]: _xarc }]]
];
var GetObjectTorrentRequest$ = [
  3,
  n0,
  _GOTRe,
  0,
  [_B, _K, _RP, _EBO],
  [[0, 1], [0, 1], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  2
];
var GetPublicAccessBlockOutput$ = [
  3,
  n0,
  _GPABO,
  0,
  [_PABC],
  [[() => PublicAccessBlockConfiguration$, 16]]
];
var GetPublicAccessBlockRequest$ = [
  3,
  n0,
  _GPABR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var GlacierJobParameters$ = [
  3,
  n0,
  _GJP,
  0,
  [_Ti],
  [0],
  1
];
var Grant$ = [
  3,
  n0,
  _Gr,
  0,
  [_Gra, _Pe],
  [[() => Grantee$, { [_xNm]: [_x, _hi] }], 0]
];
var Grantee$ = [
  3,
  n0,
  _Gra,
  0,
  [_Ty, _DN, _EA, _ID, _URI],
  [[0, { [_xA]: 1, [_xN]: _xs }], 0, 0, 0, 0],
  1
];
var HeadBucketOutput$ = [
  3,
  n0,
  _HBO,
  0,
  [_BA, _BLT, _BLN, _BR, _APA],
  [[0, { [_hH]: _xaba }], [0, { [_hH]: _xablt }], [0, { [_hH]: _xabln }], [0, { [_hH]: _xabr }], [2, { [_hH]: _xaapa }]]
];
var HeadBucketRequest$ = [
  3,
  n0,
  _HBR,
  0,
  [_B, _EBO],
  [[0, 1], [0, { [_hH]: _xaebo }]],
  1
];
var HeadObjectOutput$ = [
  3,
  n0,
  _HOO,
  0,
  [_DM, _AR, _E, _Re, _ASr, _LM, _CLo, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT, _ETa, _MM, _VI, _CC, _CDo, _CEo, _CL, _CTo, _CR, _Ex, _ES, _WRL, _SSE, _M, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _SC, _RC, _RS, _PC, _TC, _OLM, _OLRUD, _OLLHS],
  [[2, { [_hH]: _xadm }], [0, { [_hH]: _ar }], [0, { [_hH]: _xae }], [0, { [_hH]: _xar }], [0, { [_hH]: _xaas }], [4, { [_hH]: _LM_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xact }], [0, { [_hH]: _ETa }], [1, { [_hH]: _xamm }], [0, { [_hH]: _xavi }], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _CR_ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _ES }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasse }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xarc }], [0, { [_hH]: _xars }], [1, { [_hH]: _xampc }], [1, { [_hH]: _xatc }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }]]
];
var HeadObjectRequest$ = [
  3,
  n0,
  _HOR,
  0,
  [_B, _K, _IM, _IMSf, _INM, _IUS, _Ra, _RCC, _RCD, _RCE, _RCL, _RCT, _RE, _VI, _SSECA, _SSECK, _SSECKMD, _RP, _PN, _EBO, _CMh],
  [[0, 1], [0, 1], [0, { [_hH]: _IM_ }], [4, { [_hH]: _IMS_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _Ra }], [0, { [_hQ]: _rcc }], [0, { [_hQ]: _rcd }], [0, { [_hQ]: _rce }], [0, { [_hQ]: _rcl }], [0, { [_hQ]: _rct }], [6, { [_hQ]: _re }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [1, { [_hQ]: _pN }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xacm_ }]],
  2
];
var IndexDocument$ = [
  3,
  n0,
  _IDn,
  0,
  [_Su],
  [0],
  1
];
var Initiator$ = [
  3,
  n0,
  _In,
  0,
  [_ID, _DN],
  [0, 0]
];
var InputSerialization$ = [
  3,
  n0,
  _IS,
  0,
  [_CSV, _CTom, _JSON, _Parq],
  [() => CSVInput$, 0, () => JSONInput$, () => ParquetInput$]
];
var IntelligentTieringAndOperator$ = [
  3,
  n0,
  _ITAO,
  0,
  [_P, _T],
  [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var IntelligentTieringConfiguration$ = [
  3,
  n0,
  _ITC,
  0,
  [_I, _S, _Tie, _F],
  [0, 0, [() => TieringList, { [_xF]: 1, [_xN]: _Tier }], [() => IntelligentTieringFilter$, 0]],
  3
];
var IntelligentTieringFilter$ = [
  3,
  n0,
  _ITF,
  0,
  [_P, _Ta, _An],
  [0, () => Tag$, [() => IntelligentTieringAndOperator$, 0]]
];
var InventoryConfiguration$ = [
  3,
  n0,
  _IC,
  0,
  [_Des, _IE, _I, _IOV, _Sc, _F, _OF],
  [[() => InventoryDestination$, 0], 2, 0, 0, () => InventorySchedule$, () => InventoryFilter$, [() => InventoryOptionalFields, 0]],
  5
];
var InventoryDestination$ = [
  3,
  n0,
  _IDnv,
  0,
  [_SBD],
  [[() => InventoryS3BucketDestination$, 0]],
  1
];
var InventoryEncryption$ = [
  3,
  n0,
  _IEn,
  0,
  [_SSES, _SSEKMS],
  [[() => SSES3$, { [_xN]: _SS }], [() => SSEKMS$, { [_xN]: _SK }]]
];
var InventoryFilter$ = [
  3,
  n0,
  _IF,
  0,
  [_P],
  [0],
  1
];
var InventoryS3BucketDestination$ = [
  3,
  n0,
  _ISBD,
  0,
  [_B, _Fo, _AI, _P, _En],
  [0, 0, 0, 0, [() => InventoryEncryption$, 0]],
  2
];
var InventorySchedule$ = [
  3,
  n0,
  _ISn,
  0,
  [_Fr],
  [0],
  1
];
var InventoryTableConfiguration$ = [
  3,
  n0,
  _ITCn,
  0,
  [_CSo, _EC],
  [0, () => MetadataTableEncryptionConfiguration$],
  1
];
var InventoryTableConfigurationResult$ = [
  3,
  n0,
  _ITCR,
  0,
  [_CSo, _TSa, _Err, _TNa, _TA],
  [0, 0, () => ErrorDetails$, 0, 0],
  1
];
var InventoryTableConfigurationUpdates$ = [
  3,
  n0,
  _ITCU,
  0,
  [_CSo, _EC],
  [0, () => MetadataTableEncryptionConfiguration$],
  1
];
var JournalTableConfiguration$ = [
  3,
  n0,
  _JTC,
  0,
  [_REe, _EC],
  [() => RecordExpiration$, () => MetadataTableEncryptionConfiguration$],
  1
];
var JournalTableConfigurationResult$ = [
  3,
  n0,
  _JTCR,
  0,
  [_TSa, _TNa, _REe, _Err, _TA],
  [0, 0, () => RecordExpiration$, () => ErrorDetails$, 0],
  3
];
var JournalTableConfigurationUpdates$ = [
  3,
  n0,
  _JTCU,
  0,
  [_REe],
  [() => RecordExpiration$],
  1
];
var JSONInput$ = [
  3,
  n0,
  _JSONI,
  0,
  [_Ty],
  [0]
];
var JSONOutput$ = [
  3,
  n0,
  _JSONO,
  0,
  [_RD],
  [0]
];
var LambdaFunctionConfiguration$ = [
  3,
  n0,
  _LFC,
  0,
  [_LFA, _Ev, _I, _F],
  [[0, { [_xN]: _CF }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]],
  2
];
var LifecycleExpiration$ = [
  3,
  n0,
  _LEi,
  0,
  [_Da, _D, _EODM],
  [5, 1, 2]
];
var LifecycleRule$ = [
  3,
  n0,
  _LR,
  0,
  [_S, _E, _ID, _P, _F, _Tr, _NVT, _NVE, _AIMU],
  [0, () => LifecycleExpiration$, 0, 0, [() => LifecycleRuleFilter$, 0], [() => TransitionList, { [_xF]: 1, [_xN]: _Tra }], [() => NoncurrentVersionTransitionList, { [_xF]: 1, [_xN]: _NVTo }], () => NoncurrentVersionExpiration$, () => AbortIncompleteMultipartUpload$],
  1
];
var LifecycleRuleAndOperator$ = [
  3,
  n0,
  _LRAO,
  0,
  [_P, _T, _OSGT, _OSLT],
  [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }], 1, 1]
];
var LifecycleRuleFilter$ = [
  3,
  n0,
  _LRF,
  0,
  [_P, _Ta, _OSGT, _OSLT, _An],
  [0, () => Tag$, 1, 1, [() => LifecycleRuleAndOperator$, 0]]
];
var ListBucketAnalyticsConfigurationsOutput$ = [
  3,
  n0,
  _LBACO,
  { [_xN]: _LBACR },
  [_IT, _CTon, _NCT, _ACLn],
  [2, 0, 0, [() => AnalyticsConfigurationList, { [_xF]: 1, [_xN]: _ACn }]]
];
var ListBucketAnalyticsConfigurationsRequest$ = [
  3,
  n0,
  _LBACRi,
  0,
  [_B, _CTon, _EBO],
  [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]],
  1
];
var ListBucketIntelligentTieringConfigurationsOutput$ = [
  3,
  n0,
  _LBITCO,
  0,
  [_IT, _CTon, _NCT, _ITCL],
  [2, 0, 0, [() => IntelligentTieringConfigurationList, { [_xF]: 1, [_xN]: _ITC }]]
];
var ListBucketIntelligentTieringConfigurationsRequest$ = [
  3,
  n0,
  _LBITCR,
  0,
  [_B, _CTon, _EBO],
  [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]],
  1
];
var ListBucketInventoryConfigurationsOutput$ = [
  3,
  n0,
  _LBICO,
  { [_xN]: _LICR },
  [_CTon, _ICL, _IT, _NCT],
  [0, [() => InventoryConfigurationList, { [_xF]: 1, [_xN]: _IC }], 2, 0]
];
var ListBucketInventoryConfigurationsRequest$ = [
  3,
  n0,
  _LBICR,
  0,
  [_B, _CTon, _EBO],
  [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]],
  1
];
var ListBucketMetricsConfigurationsOutput$ = [
  3,
  n0,
  _LBMCO,
  { [_xN]: _LMCR },
  [_IT, _CTon, _NCT, _MCL],
  [2, 0, 0, [() => MetricsConfigurationList, { [_xF]: 1, [_xN]: _MCe }]]
];
var ListBucketMetricsConfigurationsRequest$ = [
  3,
  n0,
  _LBMCR,
  0,
  [_B, _CTon, _EBO],
  [[0, 1], [0, { [_hQ]: _ct }], [0, { [_hH]: _xaebo }]],
  1
];
var ListBucketsOutput$ = [
  3,
  n0,
  _LBO,
  { [_xN]: _LAMBR },
  [_Bu, _O, _CTon, _P],
  [[() => Buckets, 0], () => Owner$, 0, 0]
];
var ListBucketsRequest$ = [
  3,
  n0,
  _LBR,
  0,
  [_MB, _CTon, _P, _BR],
  [[1, { [_hQ]: _mb }], [0, { [_hQ]: _ct }], [0, { [_hQ]: _p }], [0, { [_hQ]: _br }]]
];
var ListDirectoryBucketsOutput$ = [
  3,
  n0,
  _LDBO,
  { [_xN]: _LAMDBR },
  [_Bu, _CTon],
  [[() => Buckets, 0], 0]
];
var ListDirectoryBucketsRequest$ = [
  3,
  n0,
  _LDBR,
  0,
  [_CTon, _MDB],
  [[0, { [_hQ]: _ct }], [1, { [_hQ]: _mdb }]]
];
var ListMultipartUploadsOutput$ = [
  3,
  n0,
  _LMUO,
  { [_xN]: _LMUR },
  [_B, _KM, _UIM, _NKM, _P, _Deli, _NUIM, _MUa, _IT, _U, _CPom, _ETn, _RC],
  [0, 0, 0, 0, 0, 0, 0, 1, 2, [() => MultipartUploadList, { [_xF]: 1, [_xN]: _Up }], [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListMultipartUploadsRequest$ = [
  3,
  n0,
  _LMURi,
  0,
  [_B, _Deli, _ETn, _KM, _MUa, _P, _UIM, _EBO, _RP],
  [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _km }], [1, { [_hQ]: _mu }], [0, { [_hQ]: _p }], [0, { [_hQ]: _uim }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]],
  1
];
var ListObjectsOutput$ = [
  3,
  n0,
  _LOO,
  { [_xN]: _LBRi },
  [_IT, _Ma, _NM, _Con, _N, _P, _Deli, _MK, _CPom, _ETn, _RC],
  [2, 0, 0, [() => ObjectList, { [_xF]: 1 }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListObjectsRequest$ = [
  3,
  n0,
  _LOR,
  0,
  [_B, _Deli, _ETn, _Ma, _MK, _P, _RP, _EBO, _OOA],
  [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _m }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [64 | 0, { [_hH]: _xaooa }]],
  1
];
var ListObjectsV2Output$ = [
  3,
  n0,
  _LOVO,
  { [_xN]: _LBRi },
  [_IT, _Con, _N, _P, _Deli, _MK, _CPom, _ETn, _KC, _CTon, _NCT, _SA, _RC],
  [2, [() => ObjectList, { [_xF]: 1 }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, 1, 0, 0, 0, [0, { [_hH]: _xarc }]]
];
var ListObjectsV2Request$ = [
  3,
  n0,
  _LOVR,
  0,
  [_B, _Deli, _ETn, _MK, _P, _CTon, _FO, _SA, _RP, _EBO, _OOA],
  [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hQ]: _ct }], [2, { [_hQ]: _fo }], [0, { [_hQ]: _sa }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [64 | 0, { [_hH]: _xaooa }]],
  1
];
var ListObjectVersionsOutput$ = [
  3,
  n0,
  _LOVOi,
  { [_xN]: _LVR },
  [_IT, _KM, _VIM, _NKM, _NVIM, _Ve, _DMe, _N, _P, _Deli, _MK, _CPom, _ETn, _RC],
  [2, 0, 0, 0, 0, [() => ObjectVersionList, { [_xF]: 1, [_xN]: _Ver }], [() => DeleteMarkers, { [_xF]: 1, [_xN]: _DM }], 0, 0, 0, 1, [() => CommonPrefixList, { [_xF]: 1 }], 0, [0, { [_hH]: _xarc }]]
];
var ListObjectVersionsRequest$ = [
  3,
  n0,
  _LOVRi,
  0,
  [_B, _Deli, _ETn, _KM, _MK, _P, _VIM, _EBO, _RP, _OOA],
  [[0, 1], [0, { [_hQ]: _d }], [0, { [_hQ]: _et }], [0, { [_hQ]: _km }], [1, { [_hQ]: _mk }], [0, { [_hQ]: _p }], [0, { [_hQ]: _vim }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }], [64 | 0, { [_hH]: _xaooa }]],
  1
];
var ListPartsOutput$ = [
  3,
  n0,
  _LPO,
  { [_xN]: _LPR },
  [_ADb, _ARI, _B, _K, _UI, _PNM, _NPNM, _MP, _IT, _Pa, _In, _O, _SC, _RC, _CA, _CT],
  [[4, { [_hH]: _xaad }], [0, { [_hH]: _xaari }], 0, 0, 0, 0, 0, 1, 2, [() => Parts, { [_xF]: 1, [_xN]: _Par }], () => Initiator$, () => Owner$, 0, [0, { [_hH]: _xarc }], 0, 0]
];
var ListPartsRequest$ = [
  3,
  n0,
  _LPRi,
  0,
  [_B, _K, _UI, _MP, _PNM, _RP, _EBO, _SSECA, _SSECK, _SSECKMD],
  [[0, 1], [0, 1], [0, { [_hQ]: _uI }], [1, { [_hQ]: _mp }], [0, { [_hQ]: _pnm }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }]],
  3
];
var LocationInfo$ = [
  3,
  n0,
  _LI,
  0,
  [_Ty, _N],
  [0, 0]
];
var LoggingEnabled$ = [
  3,
  n0,
  _LE,
  0,
  [_TB, _TP, _TG, _TOKF],
  [0, 0, [() => TargetGrants, 0], [() => TargetObjectKeyFormat$, 0]],
  2
];
var MetadataConfiguration$ = [
  3,
  n0,
  _MC,
  0,
  [_JTC, _ITCn],
  [() => JournalTableConfiguration$, () => InventoryTableConfiguration$],
  1
];
var MetadataConfigurationResult$ = [
  3,
  n0,
  _MCR,
  0,
  [_DRes, _JTCR, _ITCR],
  [() => DestinationResult$, () => JournalTableConfigurationResult$, () => InventoryTableConfigurationResult$],
  1
];
var MetadataEntry$ = [
  3,
  n0,
  _ME,
  0,
  [_N, _V],
  [0, 0]
];
var MetadataTableConfiguration$ = [
  3,
  n0,
  _MTC,
  0,
  [_STD],
  [() => S3TablesDestination$],
  1
];
var MetadataTableConfigurationResult$ = [
  3,
  n0,
  _MTCR,
  0,
  [_STDR],
  [() => S3TablesDestinationResult$],
  1
];
var MetadataTableEncryptionConfiguration$ = [
  3,
  n0,
  _MTEC,
  0,
  [_SAs, _KKA],
  [0, 0],
  1
];
var Metrics$ = [
  3,
  n0,
  _Me,
  0,
  [_S, _ETv],
  [0, () => ReplicationTimeValue$],
  1
];
var MetricsAndOperator$ = [
  3,
  n0,
  _MAO,
  0,
  [_P, _T, _APAc],
  [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }], 0]
];
var MetricsConfiguration$ = [
  3,
  n0,
  _MCe,
  0,
  [_I, _F],
  [0, [() => MetricsFilter$, 0]],
  1
];
var MultipartUpload$ = [
  3,
  n0,
  _MU,
  0,
  [_UI, _K, _Ini, _SC, _O, _In, _CA, _CT],
  [0, 0, 4, 0, () => Owner$, () => Initiator$, 0, 0]
];
var NoncurrentVersionExpiration$ = [
  3,
  n0,
  _NVE,
  0,
  [_ND, _NNV],
  [1, 1]
];
var NoncurrentVersionTransition$ = [
  3,
  n0,
  _NVTo,
  0,
  [_ND, _SC, _NNV],
  [1, 0, 1]
];
var NotificationConfiguration$ = [
  3,
  n0,
  _NC,
  0,
  [_TCo, _QCu, _LFCa, _EBC],
  [[() => TopicConfigurationList, { [_xF]: 1, [_xN]: _TCop }], [() => QueueConfigurationList, { [_xF]: 1, [_xN]: _QCue }], [() => LambdaFunctionConfigurationList, { [_xF]: 1, [_xN]: _CFC }], () => EventBridgeConfiguration$]
];
var NotificationConfigurationFilter$ = [
  3,
  n0,
  _NCF,
  0,
  [_K],
  [[() => S3KeyFilter$, { [_xN]: _SKe }]]
];
var _Object$ = [
  3,
  n0,
  _Obj,
  0,
  [_K, _LM, _ETa, _CA, _CT, _Si, _SC, _O, _RSe],
  [0, 4, 0, [64 | 0, { [_xF]: 1 }], 0, 1, 0, () => Owner$, () => RestoreStatus$]
];
var ObjectIdentifier$ = [
  3,
  n0,
  _OI,
  0,
  [_K, _VI, _ETa, _LMT, _Si],
  [0, 0, 0, 6, 1],
  1
];
var ObjectLockConfiguration$ = [
  3,
  n0,
  _OLC,
  0,
  [_OLE, _Ru],
  [0, () => ObjectLockRule$]
];
var ObjectLockLegalHold$ = [
  3,
  n0,
  _OLLH,
  0,
  [_S],
  [0]
];
var ObjectLockRetention$ = [
  3,
  n0,
  _OLR,
  0,
  [_Mo, _RUD],
  [0, 5]
];
var ObjectLockRule$ = [
  3,
  n0,
  _OLRb,
  0,
  [_DRe],
  [() => DefaultRetention$]
];
var ObjectPart$ = [
  3,
  n0,
  _OPb,
  0,
  [_PN, _Si, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
var ObjectVersion$ = [
  3,
  n0,
  _OV,
  0,
  [_ETa, _CA, _CT, _Si, _SC, _K, _VI, _IL, _LM, _O, _RSe],
  [0, [64 | 0, { [_xF]: 1 }], 0, 1, 0, 0, 0, 2, 4, () => Owner$, () => RestoreStatus$]
];
var OutputLocation$ = [
  3,
  n0,
  _OL,
  0,
  [_S_],
  [[() => S3Location$, 0]]
];
var OutputSerialization$ = [
  3,
  n0,
  _OSu,
  0,
  [_CSV, _JSON],
  [() => CSVOutput$, () => JSONOutput$]
];
var Owner$ = [
  3,
  n0,
  _O,
  0,
  [_DN, _ID],
  [0, 0]
];
var OwnershipControls$ = [
  3,
  n0,
  _OC,
  0,
  [_R],
  [[() => OwnershipControlsRules, { [_xF]: 1, [_xN]: _Ru }]],
  1
];
var OwnershipControlsRule$ = [
  3,
  n0,
  _OCR,
  0,
  [_OO],
  [0],
  1
];
var ParquetInput$ = [
  3,
  n0,
  _PI,
  0,
  [],
  []
];
var Part$ = [
  3,
  n0,
  _Par,
  0,
  [_PN, _LM, _ETa, _Si, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe],
  [1, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];
var PartitionedPrefix$ = [
  3,
  n0,
  _PP,
  { [_xN]: _PP },
  [_PDS],
  [0]
];
var PolicyStatus$ = [
  3,
  n0,
  _PS,
  0,
  [_IP],
  [[2, { [_xN]: _IP }]]
];
var Progress$ = [
  3,
  n0,
  _Pr,
  0,
  [_BS, _BP, _BRy],
  [1, 1, 1]
];
var ProgressEvent$ = [
  3,
  n0,
  _PE,
  0,
  [_Det],
  [[() => Progress$, { [_eP]: 1 }]]
];
var PublicAccessBlockConfiguration$ = [
  3,
  n0,
  _PABC,
  0,
  [_BPA, _IPA, _BPP, _RPB],
  [[2, { [_xN]: _BPA }], [2, { [_xN]: _IPA }], [2, { [_xN]: _BPP }], [2, { [_xN]: _RPB }]]
];
var PutBucketAbacRequest$ = [
  3,
  n0,
  _PBAR,
  0,
  [_B, _AS, _CMDo, _CA, _EBO],
  [[0, 1], [() => AbacStatus$, { [_hP]: 1, [_xN]: _AS }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketAccelerateConfigurationRequest$ = [
  3,
  n0,
  _PBACR,
  0,
  [_B, _AC, _EBO, _CA],
  [[0, 1], [() => AccelerateConfiguration$, { [_hP]: 1, [_xN]: _AC }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]],
  2
];
var PutBucketAclRequest$ = [
  3,
  n0,
  _PBARu,
  0,
  [_B, _ACL_, _ACP, _CMDo, _CA, _GFC, _GR, _GRACP, _GW, _GWACP, _EBO],
  [[0, 1], [0, { [_hH]: _xaa }], [() => AccessControlPolicy$, { [_hP]: 1, [_xN]: _ACP }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _xaebo }]],
  1
];
var PutBucketAnalyticsConfigurationRequest$ = [
  3,
  n0,
  _PBACRu,
  0,
  [_B, _I, _ACn, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [() => AnalyticsConfiguration$, { [_hP]: 1, [_xN]: _ACn }], [0, { [_hH]: _xaebo }]],
  3
];
var PutBucketCorsRequest$ = [
  3,
  n0,
  _PBCR,
  0,
  [_B, _CORSC, _CMDo, _CA, _EBO],
  [[0, 1], [() => CORSConfiguration$, { [_hP]: 1, [_xN]: _CORSC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketEncryptionRequest$ = [
  3,
  n0,
  _PBER,
  0,
  [_B, _SSEC, _CMDo, _CA, _EBO],
  [[0, 1], [() => ServerSideEncryptionConfiguration$, { [_hP]: 1, [_xN]: _SSEC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketIntelligentTieringConfigurationRequest$ = [
  3,
  n0,
  _PBITCR,
  0,
  [_B, _I, _ITC, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [() => IntelligentTieringConfiguration$, { [_hP]: 1, [_xN]: _ITC }], [0, { [_hH]: _xaebo }]],
  3
];
var PutBucketInventoryConfigurationRequest$ = [
  3,
  n0,
  _PBICR,
  0,
  [_B, _I, _IC, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [() => InventoryConfiguration$, { [_hP]: 1, [_xN]: _IC }], [0, { [_hH]: _xaebo }]],
  3
];
var PutBucketLifecycleConfigurationOutput$ = [
  3,
  n0,
  _PBLCO,
  0,
  [_TDMOS],
  [[0, { [_hH]: _xatdmos }]]
];
var PutBucketLifecycleConfigurationRequest$ = [
  3,
  n0,
  _PBLCR,
  0,
  [_B, _CA, _LCi, _EBO, _TDMOS],
  [[0, 1], [0, { [_hH]: _xasca }], [() => BucketLifecycleConfiguration$, { [_hP]: 1, [_xN]: _LCi }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xatdmos }]],
  1
];
var PutBucketLoggingRequest$ = [
  3,
  n0,
  _PBLR,
  0,
  [_B, _BLS, _CMDo, _CA, _EBO],
  [[0, 1], [() => BucketLoggingStatus$, { [_hP]: 1, [_xN]: _BLS }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketMetricsConfigurationRequest$ = [
  3,
  n0,
  _PBMCR,
  0,
  [_B, _I, _MCe, _EBO],
  [[0, 1], [0, { [_hQ]: _i }], [() => MetricsConfiguration$, { [_hP]: 1, [_xN]: _MCe }], [0, { [_hH]: _xaebo }]],
  3
];
var PutBucketNotificationConfigurationRequest$ = [
  3,
  n0,
  _PBNCR,
  0,
  [_B, _NC, _EBO, _SDV],
  [[0, 1], [() => NotificationConfiguration$, { [_hP]: 1, [_xN]: _NC }], [0, { [_hH]: _xaebo }], [2, { [_hH]: _xasdv }]],
  2
];
var PutBucketOwnershipControlsRequest$ = [
  3,
  n0,
  _PBOCR,
  0,
  [_B, _OC, _CMDo, _EBO, _CA],
  [[0, 1], [() => OwnershipControls$, { [_hP]: 1, [_xN]: _OC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasca }]],
  2
];
var PutBucketPolicyRequest$ = [
  3,
  n0,
  _PBPR,
  0,
  [_B, _Po, _CMDo, _CA, _CRSBA, _EBO],
  [[0, 1], [0, 16], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [2, { [_hH]: _xacrsba }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketReplicationRequest$ = [
  3,
  n0,
  _PBRR,
  0,
  [_B, _RCe, _CMDo, _CA, _To, _EBO],
  [[0, 1], [() => ReplicationConfiguration$, { [_hP]: 1, [_xN]: _RCe }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xabolt }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketRequestPaymentRequest$ = [
  3,
  n0,
  _PBRPR,
  0,
  [_B, _RPC, _CMDo, _CA, _EBO],
  [[0, 1], [() => RequestPaymentConfiguration$, { [_hP]: 1, [_xN]: _RPC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketTaggingRequest$ = [
  3,
  n0,
  _PBTR,
  0,
  [_B, _Tag, _CMDo, _CA, _EBO],
  [[0, 1], [() => Tagging$, { [_hP]: 1, [_xN]: _Tag }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketVersioningRequest$ = [
  3,
  n0,
  _PBVR,
  0,
  [_B, _VC, _CMDo, _CA, _MFA, _EBO],
  [[0, 1], [() => VersioningConfiguration$, { [_hP]: 1, [_xN]: _VC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xam_ }], [0, { [_hH]: _xaebo }]],
  2
];
var PutBucketWebsiteRequest$ = [
  3,
  n0,
  _PBWR,
  0,
  [_B, _WC, _CMDo, _CA, _EBO],
  [[0, 1], [() => WebsiteConfiguration$, { [_hP]: 1, [_xN]: _WC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutObjectAclOutput$ = [
  3,
  n0,
  _POAO,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var PutObjectAclRequest$ = [
  3,
  n0,
  _POAR,
  0,
  [_B, _K, _ACL_, _ACP, _CMDo, _CA, _GFC, _GR, _GRACP, _GW, _GWACP, _RP, _VI, _EBO],
  [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [() => AccessControlPolicy$, { [_hP]: 1, [_xN]: _ACP }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagw }], [0, { [_hH]: _xagwa }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [0, { [_hH]: _xaebo }]],
  2
];
var PutObjectLegalHoldOutput$ = [
  3,
  n0,
  _POLHO,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var PutObjectLegalHoldRequest$ = [
  3,
  n0,
  _POLHR,
  0,
  [_B, _K, _LH, _RP, _VI, _CMDo, _CA, _EBO],
  [[0, 1], [0, 1], [() => ObjectLockLegalHold$, { [_hP]: 1, [_xN]: _LH }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutObjectLockConfigurationOutput$ = [
  3,
  n0,
  _POLCO,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var PutObjectLockConfigurationRequest$ = [
  3,
  n0,
  _POLCR,
  0,
  [_B, _OLC, _RP, _To, _CMDo, _CA, _EBO],
  [[0, 1], [() => ObjectLockConfiguration$, { [_hP]: 1, [_xN]: _OLC }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xabolt }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  1
];
var PutObjectOutput$ = [
  3,
  n0,
  _POO,
  0,
  [_E, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _CT, _SSE, _VI, _SSECA, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _Si, _RC],
  [[0, { [_hH]: _xae }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xact }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xavi }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [1, { [_hH]: _xaos }], [0, { [_hH]: _xarc }]]
];
var PutObjectRequest$ = [
  3,
  n0,
  _POR,
  0,
  [_B, _K, _ACL_, _Bo, _CC, _CDo, _CEo, _CL, _CLo, _CMDo, _CTo, _CA, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _Ex, _IM, _INM, _GFC, _GR, _GRACP, _GWACP, _WOB, _M, _SSE, _SC, _WRL, _SSECA, _SSECK, _SSECKMD, _SSEKMSKI, _SSEKMSEC, _BKE, _RP, _Tag, _OLM, _OLRUD, _OLLHS, _EBO],
  [[0, 1], [0, 1], [0, { [_hH]: _xaa }], [() => StreamingBlob, 16], [0, { [_hH]: _CC_ }], [0, { [_hH]: _CD_ }], [0, { [_hH]: _CE_ }], [0, { [_hH]: _CL_ }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _CM }], [0, { [_hH]: _CT_ }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [4, { [_hH]: _Ex }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [0, { [_hH]: _xagfc }], [0, { [_hH]: _xagr }], [0, { [_hH]: _xagra }], [0, { [_hH]: _xagwa }], [1, { [_hH]: _xawob }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasc }], [0, { [_hH]: _xawrl }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [() => SSEKMSEncryptionContext, { [_hH]: _xassec }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xat }], [0, { [_hH]: _xaolm }], [5, { [_hH]: _xaolrud }], [0, { [_hH]: _xaollh }], [0, { [_hH]: _xaebo }]],
  2
];
var PutObjectRetentionOutput$ = [
  3,
  n0,
  _PORO,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var PutObjectRetentionRequest$ = [
  3,
  n0,
  _PORR,
  0,
  [_B, _K, _Ret, _RP, _VI, _BGR, _CMDo, _CA, _EBO],
  [[0, 1], [0, 1], [() => ObjectLockRetention$, { [_hP]: 1, [_xN]: _Ret }], [0, { [_hH]: _xarp }], [0, { [_hQ]: _vI }], [2, { [_hH]: _xabgr }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var PutObjectTaggingOutput$ = [
  3,
  n0,
  _POTO,
  0,
  [_VI],
  [[0, { [_hH]: _xavi }]]
];
var PutObjectTaggingRequest$ = [
  3,
  n0,
  _POTR,
  0,
  [_B, _K, _Tag, _VI, _CMDo, _CA, _EBO, _RP],
  [[0, 1], [0, 1], [() => Tagging$, { [_hP]: 1, [_xN]: _Tag }], [0, { [_hQ]: _vI }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xarp }]],
  3
];
var PutPublicAccessBlockRequest$ = [
  3,
  n0,
  _PPABR,
  0,
  [_B, _PABC, _CMDo, _CA, _EBO],
  [[0, 1], [() => PublicAccessBlockConfiguration$, { [_hP]: 1, [_xN]: _PABC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var QueueConfiguration$ = [
  3,
  n0,
  _QCue,
  0,
  [_QA, _Ev, _I, _F],
  [[0, { [_xN]: _Qu }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]],
  2
];
var RecordExpiration$ = [
  3,
  n0,
  _REe,
  0,
  [_E, _D],
  [0, 1],
  1
];
var RecordsEvent$ = [
  3,
  n0,
  _REec,
  0,
  [_Payl],
  [[21, { [_eP]: 1 }]]
];
var Redirect$ = [
  3,
  n0,
  _Red,
  0,
  [_HN, _HRC, _Pro, _RKPW, _RKW],
  [0, 0, 0, 0, 0]
];
var RedirectAllRequestsTo$ = [
  3,
  n0,
  _RART,
  0,
  [_HN, _Pro],
  [0, 0],
  1
];
var RenameObjectOutput$ = [
  3,
  n0,
  _ROO,
  0,
  [],
  []
];
var RenameObjectRequest$ = [
  3,
  n0,
  _ROR,
  0,
  [_B, _K, _RSen, _DIM, _DINM, _DIMS, _DIUS, _SIM, _SINM, _SIMS, _SIUS, _CTl],
  [[0, 1], [0, 1], [0, { [_hH]: _xars_ }], [0, { [_hH]: _IM_ }], [0, { [_hH]: _INM_ }], [4, { [_hH]: _IMS_ }], [4, { [_hH]: _IUS_ }], [0, { [_hH]: _xarsim }], [0, { [_hH]: _xarsinm }], [6, { [_hH]: _xarsims }], [6, { [_hH]: _xarsius }], [0, { [_hH]: _xact_, [_iT]: 1 }]],
  3
];
var ReplicaModifications$ = [
  3,
  n0,
  _RM,
  0,
  [_S],
  [0],
  1
];
var ReplicationConfiguration$ = [
  3,
  n0,
  _RCe,
  0,
  [_Ro, _R],
  [0, [() => ReplicationRules, { [_xF]: 1, [_xN]: _Ru }]],
  2
];
var ReplicationRule$ = [
  3,
  n0,
  _RRe,
  0,
  [_S, _Des, _ID, _Pri, _P, _F, _SSC, _EOR, _DMR],
  [0, () => Destination$, 0, 1, 0, [() => ReplicationRuleFilter$, 0], () => SourceSelectionCriteria$, () => ExistingObjectReplication$, () => DeleteMarkerReplication$],
  2
];
var ReplicationRuleAndOperator$ = [
  3,
  n0,
  _RRAO,
  0,
  [_P, _T],
  [0, [() => TagSet, { [_xF]: 1, [_xN]: _Ta }]]
];
var ReplicationRuleFilter$ = [
  3,
  n0,
  _RRF,
  0,
  [_P, _Ta, _An],
  [0, () => Tag$, [() => ReplicationRuleAndOperator$, 0]]
];
var ReplicationTime$ = [
  3,
  n0,
  _RT,
  0,
  [_S, _Tim],
  [0, () => ReplicationTimeValue$],
  2
];
var ReplicationTimeValue$ = [
  3,
  n0,
  _RTV,
  0,
  [_Mi],
  [1]
];
var RequestPaymentConfiguration$ = [
  3,
  n0,
  _RPC,
  0,
  [_Pay],
  [0],
  1
];
var RequestProgress$ = [
  3,
  n0,
  _RPe,
  0,
  [_Ena],
  [2]
];
var RestoreObjectOutput$ = [
  3,
  n0,
  _ROOe,
  0,
  [_RC, _ROP],
  [[0, { [_hH]: _xarc }], [0, { [_hH]: _xarop }]]
];
var RestoreObjectRequest$ = [
  3,
  n0,
  _RORe,
  0,
  [_B, _K, _VI, _RRes, _RP, _CA, _EBO],
  [[0, 1], [0, 1], [0, { [_hQ]: _vI }], [() => RestoreRequest$, { [_hP]: 1, [_xN]: _RRes }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var RestoreRequest$ = [
  3,
  n0,
  _RRes,
  0,
  [_D, _GJP, _Ty, _Ti, _Desc, _SP, _OL],
  [1, () => GlacierJobParameters$, 0, 0, 0, () => SelectParameters$, [() => OutputLocation$, 0]]
];
var RestoreStatus$ = [
  3,
  n0,
  _RSe,
  0,
  [_IRIP, _RED],
  [2, 4]
];
var RoutingRule$ = [
  3,
  n0,
  _RRo,
  0,
  [_Red, _Co],
  [() => Redirect$, () => Condition$],
  1
];
var S3KeyFilter$ = [
  3,
  n0,
  _SKF,
  0,
  [_FRi],
  [[() => FilterRuleList, { [_xF]: 1, [_xN]: _FR }]]
];
var S3Location$ = [
  3,
  n0,
  _SL,
  0,
  [_BNu, _P, _En, _CACL, _ACL, _Tag, _UM, _SC],
  [0, 0, [() => Encryption$, 0], 0, [() => Grants, 0], [() => Tagging$, 0], [() => UserMetadata, 0], 0],
  2
];
var S3TablesDestination$ = [
  3,
  n0,
  _STD,
  0,
  [_TBA, _TNa],
  [0, 0],
  2
];
var S3TablesDestinationResult$ = [
  3,
  n0,
  _STDR,
  0,
  [_TBA, _TNa, _TA, _TN],
  [0, 0, 0, 0],
  4
];
var ScanRange$ = [
  3,
  n0,
  _SR,
  0,
  [_St, _End],
  [1, 1]
];
var SelectObjectContentOutput$ = [
  3,
  n0,
  _SOCO,
  0,
  [_Payl],
  [[() => SelectObjectContentEventStream$, 16]]
];
var SelectObjectContentRequest$ = [
  3,
  n0,
  _SOCR,
  0,
  [_B, _K, _Exp, _ETx, _IS, _OSu, _SSECA, _SSECK, _SSECKMD, _RPe, _SR, _EBO],
  [[0, 1], [0, 1], 0, 0, () => InputSerialization$, () => OutputSerialization$, [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], () => RequestProgress$, () => ScanRange$, [0, { [_hH]: _xaebo }]],
  6
];
var SelectParameters$ = [
  3,
  n0,
  _SP,
  0,
  [_IS, _ETx, _Exp, _OSu],
  [() => InputSerialization$, 0, 0, () => OutputSerialization$],
  4
];
var ServerSideEncryptionByDefault$ = [
  3,
  n0,
  _SSEBD,
  0,
  [_SSEA, _KMSMKID],
  [0, [() => SSEKMSKeyId, 0]],
  1
];
var ServerSideEncryptionConfiguration$ = [
  3,
  n0,
  _SSEC,
  0,
  [_R],
  [[() => ServerSideEncryptionRules, { [_xF]: 1, [_xN]: _Ru }]],
  1
];
var ServerSideEncryptionRule$ = [
  3,
  n0,
  _SSER,
  0,
  [_ASSEBD, _BKE, _BET],
  [[() => ServerSideEncryptionByDefault$, 0], 2, [() => BlockedEncryptionTypes$, 0]]
];
var SessionCredentials$ = [
  3,
  n0,
  _SCe,
  0,
  [_AKI, _SAK, _ST, _E],
  [[0, { [_xN]: _AKI }], [() => SessionCredentialValue, { [_xN]: _SAK }], [() => SessionCredentialValue, { [_xN]: _ST }], [4, { [_xN]: _E }]],
  4
];
var SimplePrefix$ = [
  3,
  n0,
  _SPi,
  { [_xN]: _SPi },
  [],
  []
];
var SourceSelectionCriteria$ = [
  3,
  n0,
  _SSC,
  0,
  [_SKEO, _RM],
  [() => SseKmsEncryptedObjects$, () => ReplicaModifications$]
];
var SSEKMS$ = [
  3,
  n0,
  _SSEKMS,
  { [_xN]: _SK },
  [_KI],
  [[() => SSEKMSKeyId, 0]],
  1
];
var SseKmsEncryptedObjects$ = [
  3,
  n0,
  _SKEO,
  0,
  [_S],
  [0],
  1
];
var SSEKMSEncryption$ = [
  3,
  n0,
  _SSEKMSE,
  { [_xN]: _SK },
  [_KMSKA, _BKE],
  [[() => NonEmptyKmsKeyArnString, 0], 2],
  1
];
var SSES3$ = [
  3,
  n0,
  _SSES,
  { [_xN]: _SS },
  [],
  []
];
var Stats$ = [
  3,
  n0,
  _Sta,
  0,
  [_BS, _BP, _BRy],
  [1, 1, 1]
];
var StatsEvent$ = [
  3,
  n0,
  _SE,
  0,
  [_Det],
  [[() => Stats$, { [_eP]: 1 }]]
];
var StorageClassAnalysis$ = [
  3,
  n0,
  _SCA,
  0,
  [_DE],
  [() => StorageClassAnalysisDataExport$]
];
var StorageClassAnalysisDataExport$ = [
  3,
  n0,
  _SCADE,
  0,
  [_OSV, _Des],
  [0, () => AnalyticsExportDestination$],
  2
];
var Tag$ = [
  3,
  n0,
  _Ta,
  0,
  [_K, _V],
  [0, 0],
  2
];
var Tagging$ = [
  3,
  n0,
  _Tag,
  0,
  [_TS],
  [[() => TagSet, 0]],
  1
];
var TargetGrant$ = [
  3,
  n0,
  _TGa,
  0,
  [_Gra, _Pe],
  [[() => Grantee$, { [_xNm]: [_x, _hi] }], 0]
];
var TargetObjectKeyFormat$ = [
  3,
  n0,
  _TOKF,
  0,
  [_SPi, _PP],
  [[() => SimplePrefix$, { [_xN]: _SPi }], [() => PartitionedPrefix$, { [_xN]: _PP }]]
];
var Tiering$ = [
  3,
  n0,
  _Tier,
  0,
  [_D, _AT],
  [1, 0],
  2
];
var TopicConfiguration$ = [
  3,
  n0,
  _TCop,
  0,
  [_TAo, _Ev, _I, _F],
  [[0, { [_xN]: _Top }], [64 | 0, { [_xF]: 1, [_xN]: _Eve }], 0, [() => NotificationConfigurationFilter$, 0]],
  2
];
var Transition$ = [
  3,
  n0,
  _Tra,
  0,
  [_Da, _D, _SC],
  [5, 1, 0]
];
var UpdateBucketMetadataInventoryTableConfigurationRequest$ = [
  3,
  n0,
  _UBMITCR,
  0,
  [_B, _ITCn, _CMDo, _CA, _EBO],
  [[0, 1], [() => InventoryTableConfigurationUpdates$, { [_hP]: 1, [_xN]: _ITCn }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var UpdateBucketMetadataJournalTableConfigurationRequest$ = [
  3,
  n0,
  _UBMJTCR,
  0,
  [_B, _JTC, _CMDo, _CA, _EBO],
  [[0, 1], [() => JournalTableConfigurationUpdates$, { [_hP]: 1, [_xN]: _JTC }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xaebo }]],
  2
];
var UpdateObjectEncryptionRequest$ = [
  3,
  n0,
  _UOER,
  0,
  [_B, _K, _OE, _VI, _RP, _EBO, _CMDo, _CA],
  [[0, 1], [0, 1], [() => ObjectEncryption$, 16], [0, { [_hQ]: _vI }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }]],
  3
];
var UpdateObjectEncryptionResponse$ = [
  3,
  n0,
  _UOERp,
  0,
  [_RC],
  [[0, { [_hH]: _xarc }]]
];
var UploadPartCopyOutput$ = [
  3,
  n0,
  _UPCO,
  0,
  [_CSVI, _CPR, _SSE, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _RC],
  [[0, { [_hH]: _xacsvi }], [() => CopyPartResult$, 16], [0, { [_hH]: _xasse }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var UploadPartCopyRequest$ = [
  3,
  n0,
  _UPCR,
  0,
  [_B, _CS, _K, _PN, _UI, _CSIM, _CSIMS, _CSINM, _CSIUS, _CSRo, _SSECA, _SSECK, _SSECKMD, _CSSSECA, _CSSSECK, _CSSSECKMD, _RP, _EBO, _ESBO],
  [[0, 1], [0, { [_hH]: _xacs___ }], [0, 1], [1, { [_hQ]: _pN }], [0, { [_hQ]: _uI }], [0, { [_hH]: _xacsim }], [4, { [_hH]: _xacsims }], [0, { [_hH]: _xacsinm }], [4, { [_hH]: _xacsius }], [0, { [_hH]: _xacsr }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xacssseca }], [() => CopySourceSSECustomerKey, { [_hH]: _xacssseck }], [0, { [_hH]: _xacssseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }], [0, { [_hH]: _xasebo }]],
  5
];
var UploadPartOutput$ = [
  3,
  n0,
  _UPO,
  0,
  [_SSE, _ETa, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _SSECA, _SSECKMD, _SSEKMSKI, _BKE, _RC],
  [[0, { [_hH]: _xasse }], [0, { [_hH]: _ETa }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xasseca }], [0, { [_hH]: _xasseckM }], [() => SSEKMSKeyId, { [_hH]: _xasseakki }], [2, { [_hH]: _xassebke }], [0, { [_hH]: _xarc }]]
];
var UploadPartRequest$ = [
  3,
  n0,
  _UPR,
  0,
  [_B, _K, _PN, _UI, _Bo, _CLo, _CMDo, _CA, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _SSECA, _SSECK, _SSECKMD, _RP, _EBO],
  [[0, 1], [0, 1], [1, { [_hQ]: _pN }], [0, { [_hQ]: _uI }], [() => StreamingBlob, 16], [1, { [_hH]: _CL__ }], [0, { [_hH]: _CM }], [0, { [_hH]: _xasca }], [0, { [_hH]: _xacc }], [0, { [_hH]: _xacc_ }], [0, { [_hH]: _xacc__ }], [0, { [_hH]: _xacs }], [0, { [_hH]: _xacs_ }], [0, { [_hH]: _xacs__ }], [0, { [_hH]: _xacm }], [0, { [_hH]: _xacx }], [0, { [_hH]: _xacx_ }], [0, { [_hH]: _xacx__ }], [0, { [_hH]: _xasseca }], [() => SSECustomerKey, { [_hH]: _xasseck }], [0, { [_hH]: _xasseckM }], [0, { [_hH]: _xarp }], [0, { [_hH]: _xaebo }]],
  4
];
var VersioningConfiguration$ = [
  3,
  n0,
  _VC,
  0,
  [_MFAD, _S],
  [[0, { [_xN]: _MDf }], 0]
];
var WebsiteConfiguration$ = [
  3,
  n0,
  _WC,
  0,
  [_EDr, _IDn, _RART, _RR],
  [() => ErrorDocument$, () => IndexDocument$, () => RedirectAllRequestsTo$, [() => RoutingRules, 0]]
];
var WriteGetObjectResponseRequest$ = [
  3,
  n0,
  _WGORR,
  0,
  [_RReq, _RTe, _Bo, _SCt, _ECr, _EM, _AR, _CC, _CDo, _CEo, _CL, _CLo, _CR, _CTo, _CCRC, _CCRCC, _CCRCNVME, _CSHA, _CSHAh, _CSHAhe, _CMD, _CXXHASH, _CXXHASHh, _CXXHASHhe, _DM, _ETa, _Ex, _E, _LM, _MM, _M, _OLM, _OLLHS, _OLRUD, _PC, _RS, _RC, _Re, _SSE, _SSECA, _SSEKMSKI, _SSECKMD, _SC, _TC, _VI, _BKE],
  [[0, { [_hL]: 1, [_hH]: _xarr }], [0, { [_hH]: _xart }], [() => StreamingBlob, 16], [1, { [_hH]: _xafs }], [0, { [_hH]: _xafec }], [0, { [_hH]: _xafem }], [0, { [_hH]: _xafhar }], [0, { [_hH]: _xafhCC }], [0, { [_hH]: _xafhCD }], [0, { [_hH]: _xafhCE }], [0, { [_hH]: _xafhCL }], [1, { [_hH]: _CL__ }], [0, { [_hH]: _xafhCR }], [0, { [_hH]: _xafhCT }], [0, { [_hH]: _xafhxacc }], [0, { [_hH]: _xafhxacc_ }], [0, { [_hH]: _xafhxacc__ }], [0, { [_hH]: _xafhxacs }], [0, { [_hH]: _xafhxacs_ }], [0, { [_hH]: _xafhxacs__ }], [0, { [_hH]: _xafhxacm }], [0, { [_hH]: _xafhxacx }], [0, { [_hH]: _xafhxacx_ }], [0, { [_hH]: _xafhxacx__ }], [2, { [_hH]: _xafhxadm }], [0, { [_hH]: _xafhE }], [4, { [_hH]: _xafhE_ }], [0, { [_hH]: _xafhxae }], [4, { [_hH]: _xafhLM }], [1, { [_hH]: _xafhxamm }], [128 | 0, { [_hPH]: _xam }], [0, { [_hH]: _xafhxaolm }], [0, { [_hH]: _xafhxaollh }], [5, { [_hH]: _xafhxaolrud }], [1, { [_hH]: _xafhxampc }], [0, { [_hH]: _xafhxars }], [0, { [_hH]: _xafhxarc }], [0, { [_hH]: _xafhxar }], [0, { [_hH]: _xafhxasse }], [0, { [_hH]: _xafhxasseca }], [() => SSEKMSKeyId, { [_hH]: _xafhxasseakki }], [0, { [_hH]: _xafhxasseckM }], [0, { [_hH]: _xafhxasc }], [1, { [_hH]: _xafhxatc }], [0, { [_hH]: _xafhxavi }], [2, { [_hH]: _xafhxassebke }]],
  2
];
var __Unit = "unit";
var AllowedHeaders = 64 | 0;
var AllowedMethods = 64 | 0;
var AllowedOrigins = 64 | 0;
var AnalyticsConfigurationList = [
  1,
  n0,
  _ACLn,
  0,
  [
    () => AnalyticsConfiguration$,
    0
  ]
];
var Buckets = [
  1,
  n0,
  _Bu,
  0,
  [
    () => Bucket$,
    { [_xN]: _B }
  ]
];
var ChecksumAlgorithmList = 64 | 0;
var CommonPrefixList = [
  1,
  n0,
  _CPL,
  0,
  () => CommonPrefix$
];
var CompletedPartList = [
  1,
  n0,
  _CPLo,
  0,
  () => CompletedPart$
];
var CORSRules = [
  1,
  n0,
  _CORSR,
  0,
  [
    () => CORSRule$,
    0
  ]
];
var DeletedObjects = [
  1,
  n0,
  _DOe,
  0,
  () => DeletedObject$
];
var DeleteMarkers = [
  1,
  n0,
  _DMe,
  0,
  () => DeleteMarkerEntry$
];
var EncryptionTypeList = [
  1,
  n0,
  _ETL,
  0,
  [
    0,
    { [_xN]: _ET }
  ]
];
var Errors = [
  1,
  n0,
  _Er,
  0,
  () => _Error$
];
var EventList = 64 | 0;
var ExposeHeaders = 64 | 0;
var FilterRuleList = [
  1,
  n0,
  _FRL,
  0,
  () => FilterRule$
];
var Grants = [
  1,
  n0,
  _G,
  0,
  [
    () => Grant$,
    { [_xN]: _Gr }
  ]
];
var IntelligentTieringConfigurationList = [
  1,
  n0,
  _ITCL,
  0,
  [
    () => IntelligentTieringConfiguration$,
    0
  ]
];
var InventoryConfigurationList = [
  1,
  n0,
  _ICL,
  0,
  [
    () => InventoryConfiguration$,
    0
  ]
];
var InventoryOptionalFields = [
  1,
  n0,
  _IOF,
  0,
  [
    0,
    { [_xN]: _Fi }
  ]
];
var LambdaFunctionConfigurationList = [
  1,
  n0,
  _LFCL,
  0,
  [
    () => LambdaFunctionConfiguration$,
    0
  ]
];
var LifecycleRules = [
  1,
  n0,
  _LRi,
  0,
  [
    () => LifecycleRule$,
    0
  ]
];
var MetricsConfigurationList = [
  1,
  n0,
  _MCL,
  0,
  [
    () => MetricsConfiguration$,
    0
  ]
];
var MultipartUploadList = [
  1,
  n0,
  _MUL,
  0,
  () => MultipartUpload$
];
var NoncurrentVersionTransitionList = [
  1,
  n0,
  _NVTL,
  0,
  () => NoncurrentVersionTransition$
];
var ObjectAttributesList = 64 | 0;
var ObjectIdentifierList = [
  1,
  n0,
  _OIL,
  0,
  () => ObjectIdentifier$
];
var ObjectList = [
  1,
  n0,
  _OLb,
  0,
  [
    () => _Object$,
    0
  ]
];
var ObjectVersionList = [
  1,
  n0,
  _OVL,
  0,
  [
    () => ObjectVersion$,
    0
  ]
];
var OptionalObjectAttributesList = 64 | 0;
var OwnershipControlsRules = [
  1,
  n0,
  _OCRw,
  0,
  () => OwnershipControlsRule$
];
var Parts = [
  1,
  n0,
  _Pa,
  0,
  () => Part$
];
var PartsList = [
  1,
  n0,
  _PL,
  0,
  () => ObjectPart$
];
var QueueConfigurationList = [
  1,
  n0,
  _QCL,
  0,
  [
    () => QueueConfiguration$,
    0
  ]
];
var ReplicationRules = [
  1,
  n0,
  _RRep,
  0,
  [
    () => ReplicationRule$,
    0
  ]
];
var RoutingRules = [
  1,
  n0,
  _RR,
  0,
  [
    () => RoutingRule$,
    { [_xN]: _RRo }
  ]
];
var ServerSideEncryptionRules = [
  1,
  n0,
  _SSERe,
  0,
  [
    () => ServerSideEncryptionRule$,
    0
  ]
];
var TagSet = [
  1,
  n0,
  _TS,
  0,
  [
    () => Tag$,
    { [_xN]: _Ta }
  ]
];
var TargetGrants = [
  1,
  n0,
  _TG,
  0,
  [
    () => TargetGrant$,
    { [_xN]: _Gr }
  ]
];
var TieringList = [
  1,
  n0,
  _TL,
  0,
  () => Tiering$
];
var TopicConfigurationList = [
  1,
  n0,
  _TCL,
  0,
  [
    () => TopicConfiguration$,
    0
  ]
];
var TransitionList = [
  1,
  n0,
  _TLr,
  0,
  () => Transition$
];
var UserMetadata = [
  1,
  n0,
  _UM,
  0,
  [
    () => MetadataEntry$,
    { [_xN]: _ME }
  ]
];
var Metadata = 128 | 0;
var AnalyticsFilter$ = [
  4,
  n0,
  _AF,
  0,
  [_P, _Ta, _An],
  [0, () => Tag$, [() => AnalyticsAndOperator$, 0]]
];
var MetricsFilter$ = [
  4,
  n0,
  _MF,
  0,
  [_P, _Ta, _APAc, _An],
  [0, () => Tag$, 0, [() => MetricsAndOperator$, 0]]
];
var ObjectEncryption$ = [
  4,
  n0,
  _OE,
  0,
  [_SSEKMS],
  [[() => SSEKMSEncryption$, { [_xN]: _SK }]]
];
var SelectObjectContentEventStream$ = [
  4,
  n0,
  _SOCES,
  { [_st]: 1 },
  [_Rec, _Sta, _Pr, _Cont, _End],
  [[() => RecordsEvent$, 0], [() => StatsEvent$, 0], [() => ProgressEvent$, 0], () => ContinuationEvent$, () => EndEvent$]
];
var AbortMultipartUpload$ = [
  9,
  n0,
  _AMU,
  { [_h]: ["DELETE", "/{Key+}?x-id=AbortMultipartUpload", 204] },
  () => AbortMultipartUploadRequest$,
  () => AbortMultipartUploadOutput$
];
var CompleteMultipartUpload$ = [
  9,
  n0,
  _CMUo,
  { [_h]: ["POST", "/{Key+}", 200] },
  () => CompleteMultipartUploadRequest$,
  () => CompleteMultipartUploadOutput$
];
var CopyObject$ = [
  9,
  n0,
  _CO,
  { [_h]: ["PUT", "/{Key+}?x-id=CopyObject", 200] },
  () => CopyObjectRequest$,
  () => CopyObjectOutput$
];
var CreateBucket$ = [
  9,
  n0,
  _CB,
  { [_h]: ["PUT", "/", 200] },
  () => CreateBucketRequest$,
  () => CreateBucketOutput$
];
var CreateBucketMetadataConfiguration$ = [
  9,
  n0,
  _CBMC,
  { [_hC]: "-", [_h]: ["POST", "/?metadataConfiguration", 200] },
  () => CreateBucketMetadataConfigurationRequest$,
  () => __Unit
];
var CreateBucketMetadataTableConfiguration$ = [
  9,
  n0,
  _CBMTC,
  { [_hC]: "-", [_h]: ["POST", "/?metadataTable", 200] },
  () => CreateBucketMetadataTableConfigurationRequest$,
  () => __Unit
];
var CreateMultipartUpload$ = [
  9,
  n0,
  _CMUr,
  { [_h]: ["POST", "/{Key+}?uploads", 200] },
  () => CreateMultipartUploadRequest$,
  () => CreateMultipartUploadOutput$
];
var CreateSession$ = [
  9,
  n0,
  _CSr,
  { [_h]: ["GET", "/?session", 200] },
  () => CreateSessionRequest$,
  () => CreateSessionOutput$
];
var DeleteBucket$ = [
  9,
  n0,
  _DB,
  { [_h]: ["DELETE", "/", 204] },
  () => DeleteBucketRequest$,
  () => __Unit
];
var DeleteBucketAnalyticsConfiguration$ = [
  9,
  n0,
  _DBAC,
  { [_h]: ["DELETE", "/?analytics", 204] },
  () => DeleteBucketAnalyticsConfigurationRequest$,
  () => __Unit
];
var DeleteBucketCors$ = [
  9,
  n0,
  _DBC,
  { [_h]: ["DELETE", "/?cors", 204] },
  () => DeleteBucketCorsRequest$,
  () => __Unit
];
var DeleteBucketEncryption$ = [
  9,
  n0,
  _DBE,
  { [_h]: ["DELETE", "/?encryption", 204] },
  () => DeleteBucketEncryptionRequest$,
  () => __Unit
];
var DeleteBucketIntelligentTieringConfiguration$ = [
  9,
  n0,
  _DBITC,
  { [_h]: ["DELETE", "/?intelligent-tiering", 204] },
  () => DeleteBucketIntelligentTieringConfigurationRequest$,
  () => __Unit
];
var DeleteBucketInventoryConfiguration$ = [
  9,
  n0,
  _DBIC,
  { [_h]: ["DELETE", "/?inventory", 204] },
  () => DeleteBucketInventoryConfigurationRequest$,
  () => __Unit
];
var DeleteBucketLifecycle$ = [
  9,
  n0,
  _DBL,
  { [_h]: ["DELETE", "/?lifecycle", 204] },
  () => DeleteBucketLifecycleRequest$,
  () => __Unit
];
var DeleteBucketMetadataConfiguration$ = [
  9,
  n0,
  _DBMC,
  { [_h]: ["DELETE", "/?metadataConfiguration", 204] },
  () => DeleteBucketMetadataConfigurationRequest$,
  () => __Unit
];
var DeleteBucketMetadataTableConfiguration$ = [
  9,
  n0,
  _DBMTC,
  { [_h]: ["DELETE", "/?metadataTable", 204] },
  () => DeleteBucketMetadataTableConfigurationRequest$,
  () => __Unit
];
var DeleteBucketMetricsConfiguration$ = [
  9,
  n0,
  _DBMCe,
  { [_h]: ["DELETE", "/?metrics", 204] },
  () => DeleteBucketMetricsConfigurationRequest$,
  () => __Unit
];
var DeleteBucketOwnershipControls$ = [
  9,
  n0,
  _DBOC,
  { [_h]: ["DELETE", "/?ownershipControls", 204] },
  () => DeleteBucketOwnershipControlsRequest$,
  () => __Unit
];
var DeleteBucketPolicy$ = [
  9,
  n0,
  _DBP,
  { [_h]: ["DELETE", "/?policy", 204] },
  () => DeleteBucketPolicyRequest$,
  () => __Unit
];
var DeleteBucketReplication$ = [
  9,
  n0,
  _DBRe,
  { [_h]: ["DELETE", "/?replication", 204] },
  () => DeleteBucketReplicationRequest$,
  () => __Unit
];
var DeleteBucketTagging$ = [
  9,
  n0,
  _DBT,
  { [_h]: ["DELETE", "/?tagging", 204] },
  () => DeleteBucketTaggingRequest$,
  () => __Unit
];
var DeleteBucketWebsite$ = [
  9,
  n0,
  _DBW,
  { [_h]: ["DELETE", "/?website", 204] },
  () => DeleteBucketWebsiteRequest$,
  () => __Unit
];
var DeleteObject$ = [
  9,
  n0,
  _DOel,
  { [_h]: ["DELETE", "/{Key+}?x-id=DeleteObject", 204] },
  () => DeleteObjectRequest$,
  () => DeleteObjectOutput$
];
var DeleteObjects$ = [
  9,
  n0,
  _DOele,
  { [_hC]: "-", [_h]: ["POST", "/?delete", 200] },
  () => DeleteObjectsRequest$,
  () => DeleteObjectsOutput$
];
var DeleteObjectTagging$ = [
  9,
  n0,
  _DOT,
  { [_h]: ["DELETE", "/{Key+}?tagging", 204] },
  () => DeleteObjectTaggingRequest$,
  () => DeleteObjectTaggingOutput$
];
var DeletePublicAccessBlock$ = [
  9,
  n0,
  _DPAB,
  { [_h]: ["DELETE", "/?publicAccessBlock", 204] },
  () => DeletePublicAccessBlockRequest$,
  () => __Unit
];
var GetBucketAbac$ = [
  9,
  n0,
  _GBA,
  { [_h]: ["GET", "/?abac", 200] },
  () => GetBucketAbacRequest$,
  () => GetBucketAbacOutput$
];
var GetBucketAccelerateConfiguration$ = [
  9,
  n0,
  _GBAC,
  { [_h]: ["GET", "/?accelerate", 200] },
  () => GetBucketAccelerateConfigurationRequest$,
  () => GetBucketAccelerateConfigurationOutput$
];
var GetBucketAcl$ = [
  9,
  n0,
  _GBAe,
  { [_h]: ["GET", "/?acl", 200] },
  () => GetBucketAclRequest$,
  () => GetBucketAclOutput$
];
var GetBucketAnalyticsConfiguration$ = [
  9,
  n0,
  _GBACe,
  { [_h]: ["GET", "/?analytics&x-id=GetBucketAnalyticsConfiguration", 200] },
  () => GetBucketAnalyticsConfigurationRequest$,
  () => GetBucketAnalyticsConfigurationOutput$
];
var GetBucketCors$ = [
  9,
  n0,
  _GBC,
  { [_h]: ["GET", "/?cors", 200] },
  () => GetBucketCorsRequest$,
  () => GetBucketCorsOutput$
];
var GetBucketEncryption$ = [
  9,
  n0,
  _GBE,
  { [_h]: ["GET", "/?encryption", 200] },
  () => GetBucketEncryptionRequest$,
  () => GetBucketEncryptionOutput$
];
var GetBucketIntelligentTieringConfiguration$ = [
  9,
  n0,
  _GBITC,
  { [_h]: ["GET", "/?intelligent-tiering&x-id=GetBucketIntelligentTieringConfiguration", 200] },
  () => GetBucketIntelligentTieringConfigurationRequest$,
  () => GetBucketIntelligentTieringConfigurationOutput$
];
var GetBucketInventoryConfiguration$ = [
  9,
  n0,
  _GBIC,
  { [_h]: ["GET", "/?inventory&x-id=GetBucketInventoryConfiguration", 200] },
  () => GetBucketInventoryConfigurationRequest$,
  () => GetBucketInventoryConfigurationOutput$
];
var GetBucketLifecycleConfiguration$ = [
  9,
  n0,
  _GBLC,
  { [_h]: ["GET", "/?lifecycle", 200] },
  () => GetBucketLifecycleConfigurationRequest$,
  () => GetBucketLifecycleConfigurationOutput$
];
var GetBucketLocation$ = [
  9,
  n0,
  _GBL,
  { [_h]: ["GET", "/?location", 200] },
  () => GetBucketLocationRequest$,
  () => GetBucketLocationOutput$
];
var GetBucketLogging$ = [
  9,
  n0,
  _GBLe,
  { [_h]: ["GET", "/?logging", 200] },
  () => GetBucketLoggingRequest$,
  () => GetBucketLoggingOutput$
];
var GetBucketMetadataConfiguration$ = [
  9,
  n0,
  _GBMC,
  { [_h]: ["GET", "/?metadataConfiguration", 200] },
  () => GetBucketMetadataConfigurationRequest$,
  () => GetBucketMetadataConfigurationOutput$
];
var GetBucketMetadataTableConfiguration$ = [
  9,
  n0,
  _GBMTC,
  { [_h]: ["GET", "/?metadataTable", 200] },
  () => GetBucketMetadataTableConfigurationRequest$,
  () => GetBucketMetadataTableConfigurationOutput$
];
var GetBucketMetricsConfiguration$ = [
  9,
  n0,
  _GBMCe,
  { [_h]: ["GET", "/?metrics&x-id=GetBucketMetricsConfiguration", 200] },
  () => GetBucketMetricsConfigurationRequest$,
  () => GetBucketMetricsConfigurationOutput$
];
var GetBucketNotificationConfiguration$ = [
  9,
  n0,
  _GBNC,
  { [_h]: ["GET", "/?notification", 200] },
  () => GetBucketNotificationConfigurationRequest$,
  () => NotificationConfiguration$
];
var GetBucketOwnershipControls$ = [
  9,
  n0,
  _GBOC,
  { [_h]: ["GET", "/?ownershipControls", 200] },
  () => GetBucketOwnershipControlsRequest$,
  () => GetBucketOwnershipControlsOutput$
];
var GetBucketPolicy$ = [
  9,
  n0,
  _GBP,
  { [_h]: ["GET", "/?policy", 200] },
  () => GetBucketPolicyRequest$,
  () => GetBucketPolicyOutput$
];
var GetBucketPolicyStatus$ = [
  9,
  n0,
  _GBPS,
  { [_h]: ["GET", "/?policyStatus", 200] },
  () => GetBucketPolicyStatusRequest$,
  () => GetBucketPolicyStatusOutput$
];
var GetBucketReplication$ = [
  9,
  n0,
  _GBR,
  { [_h]: ["GET", "/?replication", 200] },
  () => GetBucketReplicationRequest$,
  () => GetBucketReplicationOutput$
];
var GetBucketRequestPayment$ = [
  9,
  n0,
  _GBRP,
  { [_h]: ["GET", "/?requestPayment", 200] },
  () => GetBucketRequestPaymentRequest$,
  () => GetBucketRequestPaymentOutput$
];
var GetBucketTagging$ = [
  9,
  n0,
  _GBT,
  { [_h]: ["GET", "/?tagging", 200] },
  () => GetBucketTaggingRequest$,
  () => GetBucketTaggingOutput$
];
var GetBucketVersioning$ = [
  9,
  n0,
  _GBV,
  { [_h]: ["GET", "/?versioning", 200] },
  () => GetBucketVersioningRequest$,
  () => GetBucketVersioningOutput$
];
var GetBucketWebsite$ = [
  9,
  n0,
  _GBW,
  { [_h]: ["GET", "/?website", 200] },
  () => GetBucketWebsiteRequest$,
  () => GetBucketWebsiteOutput$
];
var GetObject$ = [
  9,
  n0,
  _GO,
  { [_hC]: "-", [_h]: ["GET", "/{Key+}?x-id=GetObject", 200] },
  () => GetObjectRequest$,
  () => GetObjectOutput$
];
var GetObjectAcl$ = [
  9,
  n0,
  _GOA,
  { [_h]: ["GET", "/{Key+}?acl", 200] },
  () => GetObjectAclRequest$,
  () => GetObjectAclOutput$
];
var GetObjectAttributes$ = [
  9,
  n0,
  _GOAe,
  { [_h]: ["GET", "/{Key+}?attributes", 200] },
  () => GetObjectAttributesRequest$,
  () => GetObjectAttributesOutput$
];
var GetObjectLegalHold$ = [
  9,
  n0,
  _GOLH,
  { [_h]: ["GET", "/{Key+}?legal-hold", 200] },
  () => GetObjectLegalHoldRequest$,
  () => GetObjectLegalHoldOutput$
];
var GetObjectLockConfiguration$ = [
  9,
  n0,
  _GOLC,
  { [_h]: ["GET", "/?object-lock", 200] },
  () => GetObjectLockConfigurationRequest$,
  () => GetObjectLockConfigurationOutput$
];
var GetObjectRetention$ = [
  9,
  n0,
  _GORe,
  { [_h]: ["GET", "/{Key+}?retention", 200] },
  () => GetObjectRetentionRequest$,
  () => GetObjectRetentionOutput$
];
var GetObjectTagging$ = [
  9,
  n0,
  _GOT,
  { [_h]: ["GET", "/{Key+}?tagging", 200] },
  () => GetObjectTaggingRequest$,
  () => GetObjectTaggingOutput$
];
var GetObjectTorrent$ = [
  9,
  n0,
  _GOTe,
  { [_h]: ["GET", "/{Key+}?torrent", 200] },
  () => GetObjectTorrentRequest$,
  () => GetObjectTorrentOutput$
];
var GetPublicAccessBlock$ = [
  9,
  n0,
  _GPAB,
  { [_h]: ["GET", "/?publicAccessBlock", 200] },
  () => GetPublicAccessBlockRequest$,
  () => GetPublicAccessBlockOutput$
];
var HeadBucket$ = [
  9,
  n0,
  _HB,
  { [_h]: ["HEAD", "/", 200] },
  () => HeadBucketRequest$,
  () => HeadBucketOutput$
];
var HeadObject$ = [
  9,
  n0,
  _HO,
  { [_h]: ["HEAD", "/{Key+}", 200] },
  () => HeadObjectRequest$,
  () => HeadObjectOutput$
];
var ListBucketAnalyticsConfigurations$ = [
  9,
  n0,
  _LBAC,
  { [_h]: ["GET", "/?analytics&x-id=ListBucketAnalyticsConfigurations", 200] },
  () => ListBucketAnalyticsConfigurationsRequest$,
  () => ListBucketAnalyticsConfigurationsOutput$
];
var ListBucketIntelligentTieringConfigurations$ = [
  9,
  n0,
  _LBITC,
  { [_h]: ["GET", "/?intelligent-tiering&x-id=ListBucketIntelligentTieringConfigurations", 200] },
  () => ListBucketIntelligentTieringConfigurationsRequest$,
  () => ListBucketIntelligentTieringConfigurationsOutput$
];
var ListBucketInventoryConfigurations$ = [
  9,
  n0,
  _LBIC,
  { [_h]: ["GET", "/?inventory&x-id=ListBucketInventoryConfigurations", 200] },
  () => ListBucketInventoryConfigurationsRequest$,
  () => ListBucketInventoryConfigurationsOutput$
];
var ListBucketMetricsConfigurations$ = [
  9,
  n0,
  _LBMC,
  { [_h]: ["GET", "/?metrics&x-id=ListBucketMetricsConfigurations", 200] },
  () => ListBucketMetricsConfigurationsRequest$,
  () => ListBucketMetricsConfigurationsOutput$
];
var ListBuckets$ = [
  9,
  n0,
  _LB,
  { [_h]: ["GET", "/?x-id=ListBuckets", 200] },
  () => ListBucketsRequest$,
  () => ListBucketsOutput$
];
var ListDirectoryBuckets$ = [
  9,
  n0,
  _LDB,
  { [_h]: ["GET", "/?x-id=ListDirectoryBuckets", 200] },
  () => ListDirectoryBucketsRequest$,
  () => ListDirectoryBucketsOutput$
];
var ListMultipartUploads$ = [
  9,
  n0,
  _LMU,
  { [_h]: ["GET", "/?uploads", 200] },
  () => ListMultipartUploadsRequest$,
  () => ListMultipartUploadsOutput$
];
var ListObjects$ = [
  9,
  n0,
  _LO,
  { [_h]: ["GET", "/", 200] },
  () => ListObjectsRequest$,
  () => ListObjectsOutput$
];
var ListObjectsV2$ = [
  9,
  n0,
  _LOV,
  { [_h]: ["GET", "/?list-type=2", 200] },
  () => ListObjectsV2Request$,
  () => ListObjectsV2Output$
];
var ListObjectVersions$ = [
  9,
  n0,
  _LOVi,
  { [_h]: ["GET", "/?versions", 200] },
  () => ListObjectVersionsRequest$,
  () => ListObjectVersionsOutput$
];
var ListParts$ = [
  9,
  n0,
  _LP,
  { [_h]: ["GET", "/{Key+}?x-id=ListParts", 200] },
  () => ListPartsRequest$,
  () => ListPartsOutput$
];
var PutBucketAbac$ = [
  9,
  n0,
  _PBA,
  { [_hC]: "-", [_h]: ["PUT", "/?abac", 200] },
  () => PutBucketAbacRequest$,
  () => __Unit
];
var PutBucketAccelerateConfiguration$ = [
  9,
  n0,
  _PBAC,
  { [_hC]: "-", [_h]: ["PUT", "/?accelerate", 200] },
  () => PutBucketAccelerateConfigurationRequest$,
  () => __Unit
];
var PutBucketAcl$ = [
  9,
  n0,
  _PBAu,
  { [_hC]: "-", [_h]: ["PUT", "/?acl", 200] },
  () => PutBucketAclRequest$,
  () => __Unit
];
var PutBucketAnalyticsConfiguration$ = [
  9,
  n0,
  _PBACu,
  { [_h]: ["PUT", "/?analytics", 200] },
  () => PutBucketAnalyticsConfigurationRequest$,
  () => __Unit
];
var PutBucketCors$ = [
  9,
  n0,
  _PBC,
  { [_hC]: "-", [_h]: ["PUT", "/?cors", 200] },
  () => PutBucketCorsRequest$,
  () => __Unit
];
var PutBucketEncryption$ = [
  9,
  n0,
  _PBE,
  { [_hC]: "-", [_h]: ["PUT", "/?encryption", 200] },
  () => PutBucketEncryptionRequest$,
  () => __Unit
];
var PutBucketIntelligentTieringConfiguration$ = [
  9,
  n0,
  _PBITC,
  { [_h]: ["PUT", "/?intelligent-tiering", 200] },
  () => PutBucketIntelligentTieringConfigurationRequest$,
  () => __Unit
];
var PutBucketInventoryConfiguration$ = [
  9,
  n0,
  _PBIC,
  { [_h]: ["PUT", "/?inventory", 200] },
  () => PutBucketInventoryConfigurationRequest$,
  () => __Unit
];
var PutBucketLifecycleConfiguration$ = [
  9,
  n0,
  _PBLC,
  { [_hC]: "-", [_h]: ["PUT", "/?lifecycle", 200] },
  () => PutBucketLifecycleConfigurationRequest$,
  () => PutBucketLifecycleConfigurationOutput$
];
var PutBucketLogging$ = [
  9,
  n0,
  _PBL,
  { [_hC]: "-", [_h]: ["PUT", "/?logging", 200] },
  () => PutBucketLoggingRequest$,
  () => __Unit
];
var PutBucketMetricsConfiguration$ = [
  9,
  n0,
  _PBMC,
  { [_h]: ["PUT", "/?metrics", 200] },
  () => PutBucketMetricsConfigurationRequest$,
  () => __Unit
];
var PutBucketNotificationConfiguration$ = [
  9,
  n0,
  _PBNC,
  { [_h]: ["PUT", "/?notification", 200] },
  () => PutBucketNotificationConfigurationRequest$,
  () => __Unit
];
var PutBucketOwnershipControls$ = [
  9,
  n0,
  _PBOC,
  { [_hC]: "-", [_h]: ["PUT", "/?ownershipControls", 200] },
  () => PutBucketOwnershipControlsRequest$,
  () => __Unit
];
var PutBucketPolicy$ = [
  9,
  n0,
  _PBP,
  { [_hC]: "-", [_h]: ["PUT", "/?policy", 200] },
  () => PutBucketPolicyRequest$,
  () => __Unit
];
var PutBucketReplication$ = [
  9,
  n0,
  _PBR,
  { [_hC]: "-", [_h]: ["PUT", "/?replication", 200] },
  () => PutBucketReplicationRequest$,
  () => __Unit
];
var PutBucketRequestPayment$ = [
  9,
  n0,
  _PBRP,
  { [_hC]: "-", [_h]: ["PUT", "/?requestPayment", 200] },
  () => PutBucketRequestPaymentRequest$,
  () => __Unit
];
var PutBucketTagging$ = [
  9,
  n0,
  _PBT,
  { [_hC]: "-", [_h]: ["PUT", "/?tagging", 200] },
  () => PutBucketTaggingRequest$,
  () => __Unit
];
var PutBucketVersioning$ = [
  9,
  n0,
  _PBV,
  { [_hC]: "-", [_h]: ["PUT", "/?versioning", 200] },
  () => PutBucketVersioningRequest$,
  () => __Unit
];
var PutBucketWebsite$ = [
  9,
  n0,
  _PBW,
  { [_hC]: "-", [_h]: ["PUT", "/?website", 200] },
  () => PutBucketWebsiteRequest$,
  () => __Unit
];
var PutObject$ = [
  9,
  n0,
  _PO,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?x-id=PutObject", 200] },
  () => PutObjectRequest$,
  () => PutObjectOutput$
];
var PutObjectAcl$ = [
  9,
  n0,
  _POA,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?acl", 200] },
  () => PutObjectAclRequest$,
  () => PutObjectAclOutput$
];
var PutObjectLegalHold$ = [
  9,
  n0,
  _POLH,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?legal-hold", 200] },
  () => PutObjectLegalHoldRequest$,
  () => PutObjectLegalHoldOutput$
];
var PutObjectLockConfiguration$ = [
  9,
  n0,
  _POLC,
  { [_hC]: "-", [_h]: ["PUT", "/?object-lock", 200] },
  () => PutObjectLockConfigurationRequest$,
  () => PutObjectLockConfigurationOutput$
];
var PutObjectRetention$ = [
  9,
  n0,
  _PORu,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?retention", 200] },
  () => PutObjectRetentionRequest$,
  () => PutObjectRetentionOutput$
];
var PutObjectTagging$ = [
  9,
  n0,
  _POT,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?tagging", 200] },
  () => PutObjectTaggingRequest$,
  () => PutObjectTaggingOutput$
];
var PutPublicAccessBlock$ = [
  9,
  n0,
  _PPAB,
  { [_hC]: "-", [_h]: ["PUT", "/?publicAccessBlock", 200] },
  () => PutPublicAccessBlockRequest$,
  () => __Unit
];
var RenameObject$ = [
  9,
  n0,
  _RO,
  { [_h]: ["PUT", "/{Key+}?renameObject", 200] },
  () => RenameObjectRequest$,
  () => RenameObjectOutput$
];
var RestoreObject$ = [
  9,
  n0,
  _ROe,
  { [_hC]: "-", [_h]: ["POST", "/{Key+}?restore", 200] },
  () => RestoreObjectRequest$,
  () => RestoreObjectOutput$
];
var SelectObjectContent$ = [
  9,
  n0,
  _SOC,
  { [_h]: ["POST", "/{Key+}?select&select-type=2", 200] },
  () => SelectObjectContentRequest$,
  () => SelectObjectContentOutput$
];
var UpdateBucketMetadataInventoryTableConfiguration$ = [
  9,
  n0,
  _UBMITC,
  { [_hC]: "-", [_h]: ["PUT", "/?metadataInventoryTable", 200] },
  () => UpdateBucketMetadataInventoryTableConfigurationRequest$,
  () => __Unit
];
var UpdateBucketMetadataJournalTableConfiguration$ = [
  9,
  n0,
  _UBMJTC,
  { [_hC]: "-", [_h]: ["PUT", "/?metadataJournalTable", 200] },
  () => UpdateBucketMetadataJournalTableConfigurationRequest$,
  () => __Unit
];
var UpdateObjectEncryption$ = [
  9,
  n0,
  _UOE,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?encryption", 200] },
  () => UpdateObjectEncryptionRequest$,
  () => UpdateObjectEncryptionResponse$
];
var UploadPart$ = [
  9,
  n0,
  _UP,
  { [_hC]: "-", [_h]: ["PUT", "/{Key+}?x-id=UploadPart", 200] },
  () => UploadPartRequest$,
  () => UploadPartOutput$
];
var UploadPartCopy$ = [
  9,
  n0,
  _UPC,
  { [_h]: ["PUT", "/{Key+}?x-id=UploadPartCopy", 200] },
  () => UploadPartCopyRequest$,
  () => UploadPartCopyOutput$
];
var WriteGetObjectResponse$ = [
  9,
  n0,
  _WGOR,
  { [_en]: ["{RequestRoute}."], [_h]: ["POST", "/WriteGetObjectResponse", 200] },
  () => WriteGetObjectResponseRequest$,
  () => __Unit
];

// node_modules/@aws-sdk/client-s3/dist-es/commands/CreateSessionCommand.js
var CreateSessionCommand = class extends Command.classBuilder().ep({
  ...commonParams,
  DisableS3ExpressSessionAuth: { type: "staticContextParams", value: true },
  Bucket: { type: "contextParams", name: "Bucket" }
}).m(function(Command2, cs, config, o2) {
  return [
    getEndpointPlugin(config, Command2.getEndpointParameterInstructions()),
    getThrow200ExceptionsPlugin(config)
  ];
}).s("AmazonS3", "CreateSession", {}).n("S3Client", "CreateSessionCommand").sc(CreateSession$).build() {
  static {
    __name(this, "CreateSessionCommand");
  }
};

// node_modules/@aws-sdk/client-s3/package.json
var package_default = {
  name: "@aws-sdk/client-s3",
  description: "AWS SDK for JavaScript S3 Client for Node.js, Browser and React Native",
  version: "3.1053.0",
  scripts: {
    build: "concurrently 'yarn:build:types' 'yarn:build:es' && yarn build:cjs",
    "build:cjs": "node ../../scripts/compilation/inline client-s3",
    "build:es": "tsc -p tsconfig.es.json",
    "build:include:deps": 'yarn g:turbo run build -F="$npm_package_name"',
    "build:types": "tsc -p tsconfig.types.json",
    "build:types:downlevel": "downlevel-dts dist-types dist-types/ts3.4",
    clean: "premove dist-cjs dist-es dist-types tsconfig.cjs.tsbuildinfo tsconfig.es.tsbuildinfo tsconfig.types.tsbuildinfo",
    "extract:docs": "api-extractor run --local",
    "generate:client": "node ../../scripts/generate-clients/single-service --solo s3",
    test: "yarn g:vitest run",
    "test:browser": "node ./test/browser-build/esbuild && yarn g:vitest run -c vitest.config.browser.mts",
    "test:browser:watch": "node ./test/browser-build/esbuild && yarn g:vitest watch -c vitest.config.browser.mts",
    "test:e2e": "yarn g:vitest run -c vitest.config.e2e.mts && yarn test:browser",
    "test:e2e:watch": "yarn g:vitest watch -c vitest.config.e2e.mts",
    "test:index": "tsc --noEmit ./test/index-types.ts && node ./test/index-objects.spec.mjs",
    "test:integration": "yarn g:vitest run -c vitest.config.integ.mts",
    "test:integration:watch": "yarn g:vitest watch -c vitest.config.integ.mts",
    "test:watch": "yarn g:vitest watch"
  },
  main: "./dist-cjs/index.js",
  types: "./dist-types/index.d.ts",
  module: "./dist-es/index.js",
  sideEffects: false,
  dependencies: {
    "@aws-crypto/sha1-browser": "5.2.0",
    "@aws-crypto/sha256-browser": "5.2.0",
    "@aws-crypto/sha256-js": "5.2.0",
    "@aws-sdk/core": "^3.974.13",
    "@aws-sdk/credential-provider-node": "^3.972.44",
    "@aws-sdk/middleware-bucket-endpoint": "^3.972.15",
    "@aws-sdk/middleware-expect-continue": "^3.972.13",
    "@aws-sdk/middleware-flexible-checksums": "^3.974.21",
    "@aws-sdk/middleware-location-constraint": "^3.972.11",
    "@aws-sdk/middleware-sdk-s3": "^3.972.42",
    "@aws-sdk/middleware-ssec": "^3.972.11",
    "@aws-sdk/signature-v4-multi-region": "^3.996.28",
    "@aws-sdk/types": "^3.973.9",
    "@smithy/core": "^3.24.3",
    "@smithy/fetch-http-handler": "^5.4.3",
    "@smithy/node-http-handler": "^4.7.3",
    "@smithy/types": "^4.14.2",
    tslib: "^2.6.2"
  },
  devDependencies: {
    "@aws-sdk/signature-v4-crt": "3.1053.0",
    "@smithy/snapshot-testing": "^2.1.3",
    "@tsconfig/node20": "20.1.8",
    "@types/node": "^20.14.8",
    concurrently: "7.0.0",
    "downlevel-dts": "0.10.1",
    premove: "4.0.0",
    typescript: "~5.8.3",
    vitest: "^4.0.17"
  },
  engines: {
    node: ">=20.0.0"
  },
  typesVersions: {
    "<4.5": {
      "dist-types/*": [
        "dist-types/ts3.4/*"
      ]
    }
  },
  files: [
    "dist-*/**"
  ],
  author: {
    name: "AWS SDK for JavaScript Team",
    url: "https://aws.amazon.com/javascript/"
  },
  license: "Apache-2.0",
  browser: {
    "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.browser"
  },
  "react-native": {
    "./dist-es/runtimeConfig": "./dist-es/runtimeConfig.native"
  },
  homepage: "https://github.com/aws/aws-sdk-js-v3/tree/main/clients/client-s3",
  repository: {
    type: "git",
    url: "https://github.com/aws/aws-sdk-js-v3.git",
    directory: "clients/client-s3"
  }
};

// node_modules/@aws-crypto/sha1-browser/build/module/webCryptoSha1.js
init_dist_es2();

// node_modules/@aws-crypto/sha1-browser/build/module/isEmptyData.js
function isEmptyData2(data) {
  if (typeof data === "string") {
    return data.length === 0;
  }
  return data.byteLength === 0;
}
__name(isEmptyData2, "isEmptyData");

// node_modules/@aws-crypto/sha1-browser/build/module/constants.js
var SHA_1_HASH = { name: "SHA-1" };
var SHA_1_HMAC_ALGO = {
  name: "HMAC",
  hash: SHA_1_HASH
};
var EMPTY_DATA_SHA_1 = new Uint8Array([
  218,
  57,
  163,
  238,
  94,
  107,
  75,
  13,
  50,
  85,
  191,
  239,
  149,
  96,
  24,
  144,
  175,
  216,
  7,
  9
]);

// node_modules/@aws-sdk/util-locate-window/dist-es/index.js
var fallbackWindow = {};
function locateWindow() {
  if (typeof window !== "undefined") {
    return window;
  } else if (typeof self !== "undefined") {
    return self;
  }
  return fallbackWindow;
}
__name(locateWindow, "locateWindow");

// node_modules/@aws-crypto/sha1-browser/build/module/webCryptoSha1.js
var Sha1 = (
  /** @class */
  (function() {
    function Sha13(secret) {
      this.toHash = new Uint8Array(0);
      if (secret !== void 0) {
        this.key = new Promise(function(resolve, reject) {
          locateWindow().crypto.subtle.importKey("raw", convertToBuffer2(secret), SHA_1_HMAC_ALGO, false, ["sign"]).then(resolve, reject);
        });
        this.key.catch(function() {
        });
      }
    }
    __name(Sha13, "Sha1");
    Sha13.prototype.update = function(data) {
      if (isEmptyData2(data)) {
        return;
      }
      var update = convertToBuffer2(data);
      var typedArray = new Uint8Array(this.toHash.byteLength + update.byteLength);
      typedArray.set(this.toHash, 0);
      typedArray.set(update, this.toHash.byteLength);
      this.toHash = typedArray;
    };
    Sha13.prototype.digest = function() {
      var _this = this;
      if (this.key) {
        return this.key.then(function(key) {
          return locateWindow().crypto.subtle.sign(SHA_1_HMAC_ALGO, key, _this.toHash).then(function(data) {
            return new Uint8Array(data);
          });
        });
      }
      if (isEmptyData2(this.toHash)) {
        return Promise.resolve(EMPTY_DATA_SHA_1);
      }
      return Promise.resolve().then(function() {
        return locateWindow().crypto.subtle.digest(SHA_1_HASH, _this.toHash);
      }).then(function(data) {
        return Promise.resolve(new Uint8Array(data));
      });
    };
    Sha13.prototype.reset = function() {
      this.toHash = new Uint8Array(0);
    };
    return Sha13;
  })()
);
function convertToBuffer2(data) {
  if (typeof data === "string") {
    return fromUtf82(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
  }
  return new Uint8Array(data);
}
__name(convertToBuffer2, "convertToBuffer");

// node_modules/@aws-crypto/supports-web-crypto/build/module/supportsWebCrypto.js
var subtleCryptoMethods = [
  "decrypt",
  "digest",
  "encrypt",
  "exportKey",
  "generateKey",
  "importKey",
  "sign",
  "verify"
];
function supportsWebCrypto(window2) {
  if (supportsSecureRandom(window2) && typeof window2.crypto.subtle === "object") {
    var subtle = window2.crypto.subtle;
    return supportsSubtleCrypto(subtle);
  }
  return false;
}
__name(supportsWebCrypto, "supportsWebCrypto");
function supportsSecureRandom(window2) {
  if (typeof window2 === "object" && typeof window2.crypto === "object") {
    var getRandomValues = window2.crypto.getRandomValues;
    return typeof getRandomValues === "function";
  }
  return false;
}
__name(supportsSecureRandom, "supportsSecureRandom");
function supportsSubtleCrypto(subtle) {
  return subtle && subtleCryptoMethods.every(function(methodName) {
    return typeof subtle[methodName] === "function";
  });
}
__name(supportsSubtleCrypto, "supportsSubtleCrypto");

// node_modules/@aws-crypto/sha1-browser/build/module/crossPlatformSha1.js
init_module();
var Sha12 = (
  /** @class */
  (function() {
    function Sha13(secret) {
      if (supportsWebCrypto(locateWindow())) {
        this.hash = new Sha1(secret);
      } else {
        throw new Error("SHA1 not supported");
      }
    }
    __name(Sha13, "Sha1");
    Sha13.prototype.update = function(data, encoding) {
      this.hash.update(convertToBuffer(data));
    };
    Sha13.prototype.digest = function() {
      return this.hash.digest();
    };
    Sha13.prototype.reset = function() {
      this.hash.reset();
    };
    return Sha13;
  })()
);

// node_modules/@aws-crypto/sha256-browser/build/module/webCryptoSha256.js
init_module();

// node_modules/@aws-crypto/sha256-browser/build/module/constants.js
var SHA_256_HASH = { name: "SHA-256" };
var SHA_256_HMAC_ALGO = {
  name: "HMAC",
  hash: SHA_256_HASH
};
var EMPTY_DATA_SHA_256 = new Uint8Array([
  227,
  176,
  196,
  66,
  152,
  252,
  28,
  20,
  154,
  251,
  244,
  200,
  153,
  111,
  185,
  36,
  39,
  174,
  65,
  228,
  100,
  155,
  147,
  76,
  164,
  149,
  153,
  27,
  120,
  82,
  184,
  85
]);

// node_modules/@aws-crypto/sha256-browser/build/module/webCryptoSha256.js
var Sha256 = (
  /** @class */
  (function() {
    function Sha2564(secret) {
      this.toHash = new Uint8Array(0);
      this.secret = secret;
      this.reset();
    }
    __name(Sha2564, "Sha256");
    Sha2564.prototype.update = function(data) {
      if (isEmptyData(data)) {
        return;
      }
      var update = convertToBuffer(data);
      var typedArray = new Uint8Array(this.toHash.byteLength + update.byteLength);
      typedArray.set(this.toHash, 0);
      typedArray.set(update, this.toHash.byteLength);
      this.toHash = typedArray;
    };
    Sha2564.prototype.digest = function() {
      var _this = this;
      if (this.key) {
        return this.key.then(function(key) {
          return locateWindow().crypto.subtle.sign(SHA_256_HMAC_ALGO, key, _this.toHash).then(function(data) {
            return new Uint8Array(data);
          });
        });
      }
      if (isEmptyData(this.toHash)) {
        return Promise.resolve(EMPTY_DATA_SHA_256);
      }
      return Promise.resolve().then(function() {
        return locateWindow().crypto.subtle.digest(SHA_256_HASH, _this.toHash);
      }).then(function(data) {
        return Promise.resolve(new Uint8Array(data));
      });
    };
    Sha2564.prototype.reset = function() {
      var _this = this;
      this.toHash = new Uint8Array(0);
      if (this.secret && this.secret !== void 0) {
        this.key = new Promise(function(resolve, reject) {
          locateWindow().crypto.subtle.importKey("raw", convertToBuffer(_this.secret), SHA_256_HMAC_ALGO, false, ["sign"]).then(resolve, reject);
        });
        this.key.catch(function() {
        });
      }
    };
    return Sha2564;
  })()
);

// node_modules/@aws-crypto/sha256-js/build/module/jsSha256.js
init_tslib_es6();

// node_modules/@aws-crypto/sha256-js/build/module/constants.js
var BLOCK_SIZE = 64;
var DIGEST_LENGTH = 32;
var KEY = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var INIT = [
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
];
var MAX_HASHABLE_LENGTH = Math.pow(2, 53) - 1;

// node_modules/@aws-crypto/sha256-js/build/module/RawSha256.js
var RawSha256 = (
  /** @class */
  (function() {
    function RawSha2562() {
      this.state = Int32Array.from(INIT);
      this.temp = new Int32Array(64);
      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.bytesHashed = 0;
      this.finished = false;
    }
    __name(RawSha2562, "RawSha256");
    RawSha2562.prototype.update = function(data) {
      if (this.finished) {
        throw new Error("Attempted to update an already finished hash.");
      }
      var position = 0;
      var byteLength = data.byteLength;
      this.bytesHashed += byteLength;
      if (this.bytesHashed * 8 > MAX_HASHABLE_LENGTH) {
        throw new Error("Cannot hash more than 2^53 - 1 bits");
      }
      while (byteLength > 0) {
        this.buffer[this.bufferLength++] = data[position++];
        byteLength--;
        if (this.bufferLength === BLOCK_SIZE) {
          this.hashBuffer();
          this.bufferLength = 0;
        }
      }
    };
    RawSha2562.prototype.digest = function() {
      if (!this.finished) {
        var bitsHashed = this.bytesHashed * 8;
        var bufferView = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
        var undecoratedLength = this.bufferLength;
        bufferView.setUint8(this.bufferLength++, 128);
        if (undecoratedLength % BLOCK_SIZE >= BLOCK_SIZE - 8) {
          for (var i2 = this.bufferLength; i2 < BLOCK_SIZE; i2++) {
            bufferView.setUint8(i2, 0);
          }
          this.hashBuffer();
          this.bufferLength = 0;
        }
        for (var i2 = this.bufferLength; i2 < BLOCK_SIZE - 8; i2++) {
          bufferView.setUint8(i2, 0);
        }
        bufferView.setUint32(BLOCK_SIZE - 8, Math.floor(bitsHashed / 4294967296), true);
        bufferView.setUint32(BLOCK_SIZE - 4, bitsHashed);
        this.hashBuffer();
        this.finished = true;
      }
      var out = new Uint8Array(DIGEST_LENGTH);
      for (var i2 = 0; i2 < 8; i2++) {
        out[i2 * 4] = this.state[i2] >>> 24 & 255;
        out[i2 * 4 + 1] = this.state[i2] >>> 16 & 255;
        out[i2 * 4 + 2] = this.state[i2] >>> 8 & 255;
        out[i2 * 4 + 3] = this.state[i2] >>> 0 & 255;
      }
      return out;
    };
    RawSha2562.prototype.hashBuffer = function() {
      var _a = this, buffer = _a.buffer, state = _a.state;
      var state0 = state[0], state1 = state[1], state2 = state[2], state3 = state[3], state4 = state[4], state5 = state[5], state6 = state[6], state7 = state[7];
      for (var i2 = 0; i2 < BLOCK_SIZE; i2++) {
        if (i2 < 16) {
          this.temp[i2] = (buffer[i2 * 4] & 255) << 24 | (buffer[i2 * 4 + 1] & 255) << 16 | (buffer[i2 * 4 + 2] & 255) << 8 | buffer[i2 * 4 + 3] & 255;
        } else {
          var u2 = this.temp[i2 - 2];
          var t1_1 = (u2 >>> 17 | u2 << 15) ^ (u2 >>> 19 | u2 << 13) ^ u2 >>> 10;
          u2 = this.temp[i2 - 15];
          var t2_1 = (u2 >>> 7 | u2 << 25) ^ (u2 >>> 18 | u2 << 14) ^ u2 >>> 3;
          this.temp[i2] = (t1_1 + this.temp[i2 - 7] | 0) + (t2_1 + this.temp[i2 - 16] | 0);
        }
        var t12 = (((state4 >>> 6 | state4 << 26) ^ (state4 >>> 11 | state4 << 21) ^ (state4 >>> 25 | state4 << 7)) + (state4 & state5 ^ ~state4 & state6) | 0) + (state7 + (KEY[i2] + this.temp[i2] | 0) | 0) | 0;
        var t22 = ((state0 >>> 2 | state0 << 30) ^ (state0 >>> 13 | state0 << 19) ^ (state0 >>> 22 | state0 << 10)) + (state0 & state1 ^ state0 & state2 ^ state1 & state2) | 0;
        state7 = state6;
        state6 = state5;
        state5 = state4;
        state4 = state3 + t12 | 0;
        state3 = state2;
        state2 = state1;
        state1 = state0;
        state0 = t12 + t22 | 0;
      }
      state[0] += state0;
      state[1] += state1;
      state[2] += state2;
      state[3] += state3;
      state[4] += state4;
      state[5] += state5;
      state[6] += state6;
      state[7] += state7;
    };
    return RawSha2562;
  })()
);

// node_modules/@aws-crypto/sha256-js/build/module/jsSha256.js
init_module();
var Sha2562 = (
  /** @class */
  (function() {
    function Sha2564(secret) {
      this.secret = secret;
      this.hash = new RawSha256();
      this.reset();
    }
    __name(Sha2564, "Sha256");
    Sha2564.prototype.update = function(toHash) {
      if (isEmptyData(toHash) || this.error) {
        return;
      }
      try {
        this.hash.update(convertToBuffer(toHash));
      } catch (e2) {
        this.error = e2;
      }
    };
    Sha2564.prototype.digestSync = function() {
      if (this.error) {
        throw this.error;
      }
      if (this.outer) {
        if (!this.outer.finished) {
          this.outer.update(this.hash.digest());
        }
        return this.outer.digest();
      }
      return this.hash.digest();
    };
    Sha2564.prototype.digest = function() {
      return __awaiter(this, void 0, void 0, function() {
        return __generator(this, function(_a) {
          return [2, this.digestSync()];
        });
      });
    };
    Sha2564.prototype.reset = function() {
      this.hash = new RawSha256();
      if (this.secret) {
        this.outer = new RawSha256();
        var inner = bufferFromSecret(this.secret);
        var outer = new Uint8Array(BLOCK_SIZE);
        outer.set(inner);
        for (var i2 = 0; i2 < BLOCK_SIZE; i2++) {
          inner[i2] ^= 54;
          outer[i2] ^= 92;
        }
        this.hash.update(inner);
        this.outer.update(outer);
        for (var i2 = 0; i2 < inner.byteLength; i2++) {
          inner[i2] = 0;
        }
      }
    };
    return Sha2564;
  })()
);
function bufferFromSecret(secret) {
  var input = convertToBuffer(secret);
  if (input.byteLength > BLOCK_SIZE) {
    var bufferHash = new RawSha256();
    bufferHash.update(input);
    input = bufferHash.digest();
  }
  var buffer = new Uint8Array(BLOCK_SIZE);
  buffer.set(input);
  return buffer;
}
__name(bufferFromSecret, "bufferFromSecret");

// node_modules/@aws-crypto/sha256-browser/build/module/crossPlatformSha256.js
init_module();
var Sha2563 = (
  /** @class */
  (function() {
    function Sha2564(secret) {
      if (supportsWebCrypto(locateWindow())) {
        this.hash = new Sha256(secret);
      } else {
        this.hash = new Sha2562(secret);
      }
    }
    __name(Sha2564, "Sha256");
    Sha2564.prototype.update = function(data, encoding) {
      this.hash.update(convertToBuffer(data));
    };
    Sha2564.prototype.digest = function() {
      return this.hash.digest();
    };
    Sha2564.prototype.reset = function() {
      this.hash.reset();
    };
    return Sha2564;
  })()
);

// node_modules/@smithy/core/dist-es/submodules/checksum/chunked-blob-reader/chunked-blob-reader.js
async function blobReader(blob, onChunk, chunkSize = 1024 * 1024) {
  const size = blob.size;
  let totalBytesRead = 0;
  while (totalBytesRead < size) {
    const slice = blob.slice(totalBytesRead, Math.min(size, totalBytesRead + chunkSize));
    onChunk(new Uint8Array(await slice.arrayBuffer()));
    totalBytesRead += slice.size;
  }
}
__name(blobReader, "blobReader");

// node_modules/@smithy/core/dist-es/submodules/checksum/hash-blob-browser/blobHasher.js
var blobHasher = /* @__PURE__ */ __name(async function blobHasher2(hashCtor, blob) {
  const hash = new hashCtor();
  await blobReader(blob, (chunk) => {
    hash.update(chunk);
  });
  return hash.digest();
}, "blobHasher");

// node_modules/@smithy/core/dist-es/submodules/checksum/md5-js/md5.js
init_index_browser2();

// node_modules/@smithy/core/dist-es/submodules/checksum/md5-js/constants.js
var BLOCK_SIZE2 = 64;
var DIGEST_LENGTH2 = 16;
var INIT2 = [1732584193, 4023233417, 2562383102, 271733878];

// node_modules/@smithy/core/dist-es/submodules/checksum/md5-js/md5.js
var Md5 = class {
  static {
    __name(this, "Md5");
  }
  state;
  buffer;
  bufferLength;
  bytesHashed;
  finished;
  constructor() {
    this.reset();
  }
  update(sourceData) {
    if (isEmptyData3(sourceData)) {
      return;
    } else if (this.finished) {
      throw new Error("Attempted to update an already finished hash.");
    }
    const data = convertToBuffer3(sourceData);
    let position = 0;
    let { byteLength } = data;
    this.bytesHashed += byteLength;
    while (byteLength > 0) {
      this.buffer.setUint8(this.bufferLength++, data[position++]);
      byteLength--;
      if (this.bufferLength === BLOCK_SIZE2) {
        this.hashBuffer();
        this.bufferLength = 0;
      }
    }
  }
  async digest() {
    if (!this.finished) {
      const { buffer, bufferLength: undecoratedLength, bytesHashed } = this;
      const bitsHashed = bytesHashed * 8;
      buffer.setUint8(this.bufferLength++, 128);
      if (undecoratedLength % BLOCK_SIZE2 >= BLOCK_SIZE2 - 8) {
        for (let i2 = this.bufferLength; i2 < BLOCK_SIZE2; i2++) {
          buffer.setUint8(i2, 0);
        }
        this.hashBuffer();
        this.bufferLength = 0;
      }
      for (let i2 = this.bufferLength; i2 < BLOCK_SIZE2 - 8; i2++) {
        buffer.setUint8(i2, 0);
      }
      buffer.setUint32(BLOCK_SIZE2 - 8, bitsHashed >>> 0, true);
      buffer.setUint32(BLOCK_SIZE2 - 4, Math.floor(bitsHashed / 4294967296), true);
      this.hashBuffer();
      this.finished = true;
    }
    const out = new DataView(new ArrayBuffer(DIGEST_LENGTH2));
    for (let i2 = 0; i2 < 4; i2++) {
      out.setUint32(i2 * 4, this.state[i2], true);
    }
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  }
  hashBuffer() {
    const { buffer, state } = this;
    let a2 = state[0], b2 = state[1], c2 = state[2], d2 = state[3];
    a2 = ff(a2, b2, c2, d2, buffer.getUint32(0, true), 7, 3614090360);
    d2 = ff(d2, a2, b2, c2, buffer.getUint32(4, true), 12, 3905402710);
    c2 = ff(c2, d2, a2, b2, buffer.getUint32(8, true), 17, 606105819);
    b2 = ff(b2, c2, d2, a2, buffer.getUint32(12, true), 22, 3250441966);
    a2 = ff(a2, b2, c2, d2, buffer.getUint32(16, true), 7, 4118548399);
    d2 = ff(d2, a2, b2, c2, buffer.getUint32(20, true), 12, 1200080426);
    c2 = ff(c2, d2, a2, b2, buffer.getUint32(24, true), 17, 2821735955);
    b2 = ff(b2, c2, d2, a2, buffer.getUint32(28, true), 22, 4249261313);
    a2 = ff(a2, b2, c2, d2, buffer.getUint32(32, true), 7, 1770035416);
    d2 = ff(d2, a2, b2, c2, buffer.getUint32(36, true), 12, 2336552879);
    c2 = ff(c2, d2, a2, b2, buffer.getUint32(40, true), 17, 4294925233);
    b2 = ff(b2, c2, d2, a2, buffer.getUint32(44, true), 22, 2304563134);
    a2 = ff(a2, b2, c2, d2, buffer.getUint32(48, true), 7, 1804603682);
    d2 = ff(d2, a2, b2, c2, buffer.getUint32(52, true), 12, 4254626195);
    c2 = ff(c2, d2, a2, b2, buffer.getUint32(56, true), 17, 2792965006);
    b2 = ff(b2, c2, d2, a2, buffer.getUint32(60, true), 22, 1236535329);
    a2 = gg(a2, b2, c2, d2, buffer.getUint32(4, true), 5, 4129170786);
    d2 = gg(d2, a2, b2, c2, buffer.getUint32(24, true), 9, 3225465664);
    c2 = gg(c2, d2, a2, b2, buffer.getUint32(44, true), 14, 643717713);
    b2 = gg(b2, c2, d2, a2, buffer.getUint32(0, true), 20, 3921069994);
    a2 = gg(a2, b2, c2, d2, buffer.getUint32(20, true), 5, 3593408605);
    d2 = gg(d2, a2, b2, c2, buffer.getUint32(40, true), 9, 38016083);
    c2 = gg(c2, d2, a2, b2, buffer.getUint32(60, true), 14, 3634488961);
    b2 = gg(b2, c2, d2, a2, buffer.getUint32(16, true), 20, 3889429448);
    a2 = gg(a2, b2, c2, d2, buffer.getUint32(36, true), 5, 568446438);
    d2 = gg(d2, a2, b2, c2, buffer.getUint32(56, true), 9, 3275163606);
    c2 = gg(c2, d2, a2, b2, buffer.getUint32(12, true), 14, 4107603335);
    b2 = gg(b2, c2, d2, a2, buffer.getUint32(32, true), 20, 1163531501);
    a2 = gg(a2, b2, c2, d2, buffer.getUint32(52, true), 5, 2850285829);
    d2 = gg(d2, a2, b2, c2, buffer.getUint32(8, true), 9, 4243563512);
    c2 = gg(c2, d2, a2, b2, buffer.getUint32(28, true), 14, 1735328473);
    b2 = gg(b2, c2, d2, a2, buffer.getUint32(48, true), 20, 2368359562);
    a2 = hh(a2, b2, c2, d2, buffer.getUint32(20, true), 4, 4294588738);
    d2 = hh(d2, a2, b2, c2, buffer.getUint32(32, true), 11, 2272392833);
    c2 = hh(c2, d2, a2, b2, buffer.getUint32(44, true), 16, 1839030562);
    b2 = hh(b2, c2, d2, a2, buffer.getUint32(56, true), 23, 4259657740);
    a2 = hh(a2, b2, c2, d2, buffer.getUint32(4, true), 4, 2763975236);
    d2 = hh(d2, a2, b2, c2, buffer.getUint32(16, true), 11, 1272893353);
    c2 = hh(c2, d2, a2, b2, buffer.getUint32(28, true), 16, 4139469664);
    b2 = hh(b2, c2, d2, a2, buffer.getUint32(40, true), 23, 3200236656);
    a2 = hh(a2, b2, c2, d2, buffer.getUint32(52, true), 4, 681279174);
    d2 = hh(d2, a2, b2, c2, buffer.getUint32(0, true), 11, 3936430074);
    c2 = hh(c2, d2, a2, b2, buffer.getUint32(12, true), 16, 3572445317);
    b2 = hh(b2, c2, d2, a2, buffer.getUint32(24, true), 23, 76029189);
    a2 = hh(a2, b2, c2, d2, buffer.getUint32(36, true), 4, 3654602809);
    d2 = hh(d2, a2, b2, c2, buffer.getUint32(48, true), 11, 3873151461);
    c2 = hh(c2, d2, a2, b2, buffer.getUint32(60, true), 16, 530742520);
    b2 = hh(b2, c2, d2, a2, buffer.getUint32(8, true), 23, 3299628645);
    a2 = ii(a2, b2, c2, d2, buffer.getUint32(0, true), 6, 4096336452);
    d2 = ii(d2, a2, b2, c2, buffer.getUint32(28, true), 10, 1126891415);
    c2 = ii(c2, d2, a2, b2, buffer.getUint32(56, true), 15, 2878612391);
    b2 = ii(b2, c2, d2, a2, buffer.getUint32(20, true), 21, 4237533241);
    a2 = ii(a2, b2, c2, d2, buffer.getUint32(48, true), 6, 1700485571);
    d2 = ii(d2, a2, b2, c2, buffer.getUint32(12, true), 10, 2399980690);
    c2 = ii(c2, d2, a2, b2, buffer.getUint32(40, true), 15, 4293915773);
    b2 = ii(b2, c2, d2, a2, buffer.getUint32(4, true), 21, 2240044497);
    a2 = ii(a2, b2, c2, d2, buffer.getUint32(32, true), 6, 1873313359);
    d2 = ii(d2, a2, b2, c2, buffer.getUint32(60, true), 10, 4264355552);
    c2 = ii(c2, d2, a2, b2, buffer.getUint32(24, true), 15, 2734768916);
    b2 = ii(b2, c2, d2, a2, buffer.getUint32(52, true), 21, 1309151649);
    a2 = ii(a2, b2, c2, d2, buffer.getUint32(16, true), 6, 4149444226);
    d2 = ii(d2, a2, b2, c2, buffer.getUint32(44, true), 10, 3174756917);
    c2 = ii(c2, d2, a2, b2, buffer.getUint32(8, true), 15, 718787259);
    b2 = ii(b2, c2, d2, a2, buffer.getUint32(36, true), 21, 3951481745);
    state[0] = a2 + state[0] & 4294967295;
    state[1] = b2 + state[1] & 4294967295;
    state[2] = c2 + state[2] & 4294967295;
    state[3] = d2 + state[3] & 4294967295;
  }
  reset() {
    this.state = Uint32Array.from(INIT2);
    this.buffer = new DataView(new ArrayBuffer(BLOCK_SIZE2));
    this.bufferLength = 0;
    this.bytesHashed = 0;
    this.finished = false;
  }
};
function cmn(q2, a2, b2, x2, s2, t8) {
  a2 = (a2 + q2 & 4294967295) + (x2 + t8 & 4294967295) & 4294967295;
  return (a2 << s2 | a2 >>> 32 - s2) + b2 & 4294967295;
}
__name(cmn, "cmn");
function ff(a2, b2, c2, d2, x2, s2, t8) {
  return cmn(b2 & c2 | ~b2 & d2, a2, b2, x2, s2, t8);
}
__name(ff, "ff");
function gg(a2, b2, c2, d2, x2, s2, t8) {
  return cmn(b2 & d2 | c2 & ~d2, a2, b2, x2, s2, t8);
}
__name(gg, "gg");
function hh(a2, b2, c2, d2, x2, s2, t8) {
  return cmn(b2 ^ c2 ^ d2, a2, b2, x2, s2, t8);
}
__name(hh, "hh");
function ii(a2, b2, c2, d2, x2, s2, t8) {
  return cmn(c2 ^ (b2 | ~d2), a2, b2, x2, s2, t8);
}
__name(ii, "ii");
function isEmptyData3(data) {
  if (typeof data === "string") {
    return data.length === 0;
  }
  return data.byteLength === 0;
}
__name(isEmptyData3, "isEmptyData");
function convertToBuffer3(data) {
  if (typeof data === "string") {
    return fromUtf8(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
  }
  return new Uint8Array(data);
}
__name(convertToBuffer3, "convertToBuffer");

// node_modules/@aws-sdk/client-s3/dist-es/runtimeConfig.browser.js
init_client3();
init_index_browser3();
init_index_browser2();

// node_modules/@smithy/fetch-http-handler/dist-es/fetch-http-handler.js
init_protocols();

// node_modules/@smithy/fetch-http-handler/dist-es/create-request.js
function createRequest(url, requestOptions) {
  return new Request(url, requestOptions);
}
__name(createRequest, "createRequest");

// node_modules/@smithy/fetch-http-handler/dist-es/request-timeout.js
function requestTimeout(timeoutInMs = 0) {
  return new Promise((resolve, reject) => {
    if (timeoutInMs) {
      setTimeout(() => {
        const timeoutError = new Error(`Request did not complete within ${timeoutInMs} ms`);
        timeoutError.name = "TimeoutError";
        reject(timeoutError);
      }, timeoutInMs);
    }
  });
}
__name(requestTimeout, "requestTimeout");

// node_modules/@smithy/fetch-http-handler/dist-es/fetch-http-handler.js
var keepAliveSupport = {
  supported: void 0
};
var FetchHttpHandler = class _FetchHttpHandler {
  static {
    __name(this, "FetchHttpHandler");
  }
  config;
  configProvider;
  static create(instanceOrOptions) {
    if (typeof instanceOrOptions?.handle === "function") {
      return instanceOrOptions;
    }
    return new _FetchHttpHandler(instanceOrOptions);
  }
  constructor(options) {
    if (typeof options === "function") {
      this.configProvider = options().then((opts) => opts || {});
    } else {
      this.config = options ?? {};
      this.configProvider = Promise.resolve(this.config);
    }
    if (keepAliveSupport.supported === void 0) {
      keepAliveSupport.supported = Boolean(typeof Request !== "undefined" && "keepalive" in createRequest("https://[::1]"));
    }
  }
  destroy() {
  }
  async handle(request, { abortSignal, requestTimeout: requestTimeout2 } = {}) {
    if (!this.config) {
      this.config = await this.configProvider;
    }
    const requestTimeoutInMs = requestTimeout2 ?? this.config.requestTimeout;
    const keepAlive = this.config.keepAlive === true;
    const credentials = this.config.credentials;
    if (abortSignal?.aborted) {
      const abortError = buildAbortError(abortSignal);
      return Promise.reject(abortError);
    }
    let path = request.path;
    const queryString = buildQueryString(request.query || {});
    if (queryString) {
      path += `?${queryString}`;
    }
    if (request.fragment) {
      path += `#${request.fragment}`;
    }
    let auth2 = "";
    if (request.username != null || request.password != null) {
      const username = request.username ?? "";
      const password = request.password ?? "";
      auth2 = `${username}:${password}@`;
    }
    const { port, method } = request;
    const url = `${request.protocol}//${auth2}${request.hostname}${port ? `:${port}` : ""}${path}`;
    const body = method === "GET" || method === "HEAD" ? void 0 : request.body;
    const requestOptions = {
      body,
      headers: new Headers(request.headers),
      method,
      credentials
    };
    if (this.config?.cache) {
      requestOptions.cache = this.config.cache;
    }
    if (body) {
      requestOptions.duplex = "half";
    }
    if (typeof AbortController !== "undefined") {
      requestOptions.signal = abortSignal;
    }
    if (keepAliveSupport.supported) {
      requestOptions.keepalive = keepAlive;
    }
    if (typeof this.config.requestInit === "function") {
      Object.assign(requestOptions, this.config.requestInit(request));
    }
    let removeSignalEventListener = /* @__PURE__ */ __name(() => {
    }, "removeSignalEventListener");
    const fetchRequest = createRequest(url, requestOptions);
    const raceOfPromises = [
      fetch(fetchRequest).then((response) => {
        const fetchHeaders = response.headers;
        const transformedHeaders = {};
        for (const pair of fetchHeaders.entries()) {
          transformedHeaders[pair[0]] = pair[1];
        }
        const hasReadableStream = response.body != void 0;
        if (!hasReadableStream) {
          return response.blob().then((body2) => ({
            response: new HttpResponse({
              headers: transformedHeaders,
              reason: response.statusText,
              statusCode: response.status,
              body: body2
            })
          }));
        }
        return {
          response: new HttpResponse({
            headers: transformedHeaders,
            reason: response.statusText,
            statusCode: response.status,
            body: response.body
          })
        };
      }),
      requestTimeout(requestTimeoutInMs)
    ];
    if (abortSignal) {
      raceOfPromises.push(new Promise((resolve, reject) => {
        const onAbort = /* @__PURE__ */ __name(() => {
          const abortError = buildAbortError(abortSignal);
          reject(abortError);
        }, "onAbort");
        if (typeof abortSignal.addEventListener === "function") {
          const signal = abortSignal;
          signal.addEventListener("abort", onAbort, { once: true });
          removeSignalEventListener = /* @__PURE__ */ __name(() => signal.removeEventListener("abort", onAbort), "removeSignalEventListener");
        } else {
          abortSignal.onabort = onAbort;
        }
      }));
    }
    return Promise.race(raceOfPromises).finally(removeSignalEventListener);
  }
  updateHttpClientConfig(key, value) {
    this.config = void 0;
    this.configProvider = this.configProvider.then((config) => {
      config[key] = value;
      return config;
    });
  }
  httpHandlerConfigs() {
    return this.config ?? {};
  }
};
function buildAbortError(abortSignal) {
  const reason = abortSignal && typeof abortSignal === "object" && "reason" in abortSignal ? abortSignal.reason : void 0;
  if (reason) {
    if (reason instanceof Error) {
      const abortError3 = new Error("Request aborted");
      abortError3.name = "AbortError";
      abortError3.cause = reason;
      return abortError3;
    }
    const abortError2 = new Error(String(reason));
    abortError2.name = "AbortError";
    return abortError2;
  }
  const abortError = new Error("Request aborted");
  abortError.name = "AbortError";
  return abortError;
}
__name(buildAbortError, "buildAbortError");

// node_modules/@smithy/fetch-http-handler/dist-es/stream-collector.js
init_index_browser2();
var streamCollector2 = /* @__PURE__ */ __name(async (stream) => {
  if (typeof Blob === "function" && stream instanceof Blob || stream.constructor?.name === "Blob") {
    if (Blob.prototype.arrayBuffer !== void 0) {
      return new Uint8Array(await stream.arrayBuffer());
    }
    return collectBlob2(stream);
  }
  return collectStream2(stream);
}, "streamCollector");
async function collectBlob2(blob) {
  const base64 = await readToBase642(blob);
  const arrayBuffer = fromBase64(base64);
  return new Uint8Array(arrayBuffer);
}
__name(collectBlob2, "collectBlob");
async function collectStream2(stream) {
  const chunks = [];
  const reader = stream.getReader();
  let isDone = false;
  let length = 0;
  while (!isDone) {
    const { done, value } = await reader.read();
    if (value) {
      chunks.push(value);
      length += value.length;
    }
    isDone = done;
  }
  const collected = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    collected.set(chunk, offset);
    offset += chunk.length;
  }
  return collected;
}
__name(collectStream2, "collectStream");
function readToBase642(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.readyState !== 2) {
        return reject(new Error("Reader aborted too early"));
      }
      const result = reader.result ?? "";
      const commaIndex = result.indexOf(",");
      const dataOffset = commaIndex > -1 ? commaIndex + 1 : result.length;
      resolve(result.substring(dataOffset));
    };
    reader.onabort = () => reject(new Error("Read aborted"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
__name(readToBase642, "readToBase64");

// node_modules/@aws-sdk/client-s3/dist-es/runtimeConfig.shared.js
init_client3();
init_protocols();
init_index_browser2();
var getRuntimeConfig = /* @__PURE__ */ __name((config) => {
  return {
    apiVersion: "2006-03-01",
    base64Decoder: config?.base64Decoder ?? fromBase64,
    base64Encoder: config?.base64Encoder ?? toBase64,
    disableHostPrefix: config?.disableHostPrefix ?? false,
    endpointProvider: config?.endpointProvider ?? defaultEndpointResolver,
    extensions: config?.extensions ?? [],
    getAwsChunkedEncodingStream: config?.getAwsChunkedEncodingStream ?? getAwsChunkedEncodingStream,
    httpAuthSchemeProvider: config?.httpAuthSchemeProvider ?? defaultS3HttpAuthSchemeProvider,
    httpAuthSchemes: config?.httpAuthSchemes ?? [
      {
        schemeId: "aws.auth#sigv4",
        identityProvider: /* @__PURE__ */ __name((ipc) => ipc.getIdentityProvider("aws.auth#sigv4"), "identityProvider"),
        signer: new AwsSdkSigV4Signer()
      },
      {
        schemeId: "aws.auth#sigv4a",
        identityProvider: /* @__PURE__ */ __name((ipc) => ipc.getIdentityProvider("aws.auth#sigv4a"), "identityProvider"),
        signer: new AwsSdkSigV4ASigner()
      }
    ],
    logger: config?.logger ?? new NoOpLogger(),
    protocol: config?.protocol ?? S3RestXmlProtocol,
    protocolSettings: config?.protocolSettings ?? {
      defaultNamespace: "com.amazonaws.s3",
      errorTypeRegistries,
      xmlNamespace: "http://s3.amazonaws.com/doc/2006-03-01/",
      version: "2006-03-01",
      serviceTarget: "AmazonS3"
    },
    sdkStreamMixin: config?.sdkStreamMixin ?? sdkStreamMixin,
    serviceId: config?.serviceId ?? "S3",
    signerConstructor: config?.signerConstructor ?? SignatureV4MultiRegion,
    signingEscapePath: config?.signingEscapePath ?? false,
    urlParser: config?.urlParser ?? parseUrl,
    useArnRegion: config?.useArnRegion ?? void 0,
    utf8Decoder: config?.utf8Decoder ?? fromUtf8,
    utf8Encoder: config?.utf8Encoder ?? toUtf8
  };
}, "getRuntimeConfig");

// node_modules/@aws-sdk/client-s3/dist-es/runtimeConfig.browser.js
var getRuntimeConfig2 = /* @__PURE__ */ __name((config) => {
  const defaultsMode = resolveDefaultsModeConfig(config);
  const defaultConfigProvider = /* @__PURE__ */ __name(() => defaultsMode().then(loadConfigsForDefaultMode), "defaultConfigProvider");
  const clientSharedValues = getRuntimeConfig(config);
  return {
    ...clientSharedValues,
    ...config,
    runtime: "browser",
    defaultsMode,
    bodyLengthChecker: config?.bodyLengthChecker ?? calculateBodyLength,
    credentialDefaultProvider: config?.credentialDefaultProvider ?? ((_) => () => Promise.reject(new Error("Credential is missing"))),
    defaultUserAgentProvider: config?.defaultUserAgentProvider ?? createDefaultUserAgentProvider({ serviceId: clientSharedValues.serviceId, clientVersion: package_default.version }),
    eventStreamSerdeProvider: config?.eventStreamSerdeProvider ?? eventStreamSerdeProvider2,
    maxAttempts: config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    md5: config?.md5 ?? Md5,
    region: config?.region ?? invalidProvider("Region is missing"),
    requestHandler: FetchHttpHandler.create(config?.requestHandler ?? defaultConfigProvider),
    retryMode: config?.retryMode ?? (async () => (await defaultConfigProvider()).retryMode || DEFAULT_RETRY_MODE),
    sha1: config?.sha1 ?? Sha12,
    sha256: config?.sha256 ?? Sha2563,
    streamCollector: config?.streamCollector ?? streamCollector2,
    streamHasher: config?.streamHasher ?? blobHasher,
    useDualstackEndpoint: config?.useDualstackEndpoint ?? (() => Promise.resolve(DEFAULT_USE_DUALSTACK_ENDPOINT)),
    useFipsEndpoint: config?.useFipsEndpoint ?? (() => Promise.resolve(DEFAULT_USE_FIPS_ENDPOINT))
  };
}, "getRuntimeConfig");

// node_modules/@aws-sdk/client-s3/dist-es/runtimeExtensions.js
init_client3();
init_protocols();

// node_modules/@aws-sdk/client-s3/dist-es/auth/httpAuthExtensionConfiguration.js
var getHttpAuthExtensionConfiguration = /* @__PURE__ */ __name((runtimeConfig) => {
  const _httpAuthSchemes = runtimeConfig.httpAuthSchemes;
  let _httpAuthSchemeProvider = runtimeConfig.httpAuthSchemeProvider;
  let _credentials = runtimeConfig.credentials;
  return {
    setHttpAuthScheme(httpAuthScheme) {
      const index = _httpAuthSchemes.findIndex((scheme) => scheme.schemeId === httpAuthScheme.schemeId);
      if (index === -1) {
        _httpAuthSchemes.push(httpAuthScheme);
      } else {
        _httpAuthSchemes.splice(index, 1, httpAuthScheme);
      }
    },
    httpAuthSchemes() {
      return _httpAuthSchemes;
    },
    setHttpAuthSchemeProvider(httpAuthSchemeProvider) {
      _httpAuthSchemeProvider = httpAuthSchemeProvider;
    },
    httpAuthSchemeProvider() {
      return _httpAuthSchemeProvider;
    },
    setCredentials(credentials) {
      _credentials = credentials;
    },
    credentials() {
      return _credentials;
    }
  };
}, "getHttpAuthExtensionConfiguration");
var resolveHttpAuthRuntimeConfig = /* @__PURE__ */ __name((config) => {
  return {
    httpAuthSchemes: config.httpAuthSchemes(),
    httpAuthSchemeProvider: config.httpAuthSchemeProvider(),
    credentials: config.credentials()
  };
}, "resolveHttpAuthRuntimeConfig");

// node_modules/@aws-sdk/client-s3/dist-es/runtimeExtensions.js
var resolveRuntimeExtensions = /* @__PURE__ */ __name((runtimeConfig, extensions) => {
  const extensionConfiguration = Object.assign(getAwsRegionExtensionConfiguration(runtimeConfig), getDefaultExtensionConfiguration(runtimeConfig), getHttpHandlerExtensionConfiguration(runtimeConfig), getHttpAuthExtensionConfiguration(runtimeConfig));
  extensions.forEach((extension) => extension.configure(extensionConfiguration));
  return Object.assign(runtimeConfig, resolveAwsRegionExtensionConfiguration(extensionConfiguration), resolveDefaultRuntimeConfig(extensionConfiguration), resolveHttpHandlerRuntimeConfig(extensionConfiguration), resolveHttpAuthRuntimeConfig(extensionConfiguration));
}, "resolveRuntimeExtensions");

// node_modules/@aws-sdk/client-s3/dist-es/S3Client.js
var S3Client = class extends Client {
  static {
    __name(this, "S3Client");
  }
  config;
  constructor(...[configuration]) {
    const _config_0 = getRuntimeConfig2(configuration || {});
    super(_config_0);
    this.initConfig = _config_0;
    const _config_1 = resolveClientEndpointParameters(_config_0);
    const _config_2 = resolveUserAgentConfig(_config_1);
    const _config_3 = resolveFlexibleChecksumsConfig(_config_2);
    const _config_4 = resolveRetryConfig(_config_3);
    const _config_5 = resolveRegionConfig(_config_4);
    const _config_6 = resolveHostHeaderConfig(_config_5);
    const _config_7 = resolveEndpointConfig(_config_6);
    const _config_8 = resolveEventStreamSerdeConfig(_config_7);
    const _config_9 = resolveHttpAuthSchemeConfig(_config_8);
    const _config_10 = resolveS3Config(_config_9, { session: [() => this, CreateSessionCommand] });
    const _config_11 = resolveRuntimeExtensions(_config_10, configuration?.extensions || []);
    this.config = _config_11;
    this.middlewareStack.use(getSchemaSerdePlugin(this.config));
    this.middlewareStack.use(getUserAgentPlugin(this.config));
    this.middlewareStack.use(getRetryPlugin(this.config));
    this.middlewareStack.use(getContentLengthPlugin(this.config));
    this.middlewareStack.use(getHostHeaderPlugin(this.config));
    this.middlewareStack.use(getLoggerPlugin(this.config));
    this.middlewareStack.use(getRecursionDetectionPlugin(this.config));
    this.middlewareStack.use(getHttpAuthSchemeEndpointRuleSetPlugin(this.config, {
      httpAuthSchemeParametersProvider: defaultS3HttpAuthSchemeParametersProvider,
      identityProviderConfigProvider: /* @__PURE__ */ __name(async (config) => new DefaultIdentityProviderConfig({
        "aws.auth#sigv4": config.credentials,
        "aws.auth#sigv4a": config.credentials
      }), "identityProviderConfigProvider")
    }));
    this.middlewareStack.use(getHttpSigningPlugin(this.config));
    this.middlewareStack.use(getValidateBucketNamePlugin(this.config));
    this.middlewareStack.use(getAddExpectContinuePlugin(this.config));
    this.middlewareStack.use(getRegionRedirectMiddlewarePlugin(this.config));
    this.middlewareStack.use(getS3ExpressPlugin(this.config));
    this.middlewareStack.use(getS3ExpressHttpSigningPlugin(this.config));
  }
  destroy() {
    super.destroy();
  }
};

// node_modules/@aws-sdk/middleware-ssec/dist-es/index.js
function ssecMiddleware(options) {
  return (next) => async (args) => {
    const input = { ...args.input };
    const properties = [
      {
        target: "SSECustomerKey",
        hash: "SSECustomerKeyMD5"
      },
      {
        target: "CopySourceSSECustomerKey",
        hash: "CopySourceSSECustomerKeyMD5"
      }
    ];
    for (const prop of properties) {
      const value = input[prop.target];
      if (value) {
        let valueForHash;
        if (typeof value === "string") {
          if (isValidBase64EncodedSSECustomerKey(value, options)) {
            valueForHash = options.base64Decoder(value);
          } else {
            valueForHash = options.utf8Decoder(value);
            input[prop.target] = options.base64Encoder(valueForHash);
          }
        } else {
          valueForHash = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
          input[prop.target] = options.base64Encoder(valueForHash);
        }
        const hash = new options.md5();
        hash.update(valueForHash);
        input[prop.hash] = options.base64Encoder(await hash.digest());
      }
    }
    return next({
      ...args,
      input
    });
  };
}
__name(ssecMiddleware, "ssecMiddleware");
var ssecMiddlewareOptions = {
  name: "ssecMiddleware",
  step: "initialize",
  tags: ["SSE"],
  override: true
};
var getSsecPlugin = /* @__PURE__ */ __name((config) => ({
  applyToStack: /* @__PURE__ */ __name((clientStack) => {
    clientStack.add(ssecMiddleware(config), ssecMiddlewareOptions);
  }, "applyToStack")
}), "getSsecPlugin");
function isValidBase64EncodedSSECustomerKey(str, options) {
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!base64Regex.test(str))
    return false;
  try {
    const decodedBytes = options.base64Decoder(str);
    return decodedBytes.length === 32;
  } catch {
    return false;
  }
}
__name(isValidBase64EncodedSSECustomerKey, "isValidBase64EncodedSSECustomerKey");

// node_modules/@aws-sdk/client-s3/dist-es/commands/GetObjectCommand.js
init_client3();
init_index_browser();
var GetObjectCommand = class extends Command.classBuilder().ep({
  ...commonParams,
  Bucket: { type: "contextParams", name: "Bucket" },
  Key: { type: "contextParams", name: "Key" }
}).m(function(Command2, cs, config, o2) {
  return [
    getEndpointPlugin(config, Command2.getEndpointParameterInstructions()),
    getFlexibleChecksumsPlugin(config, {
      requestChecksumRequired: false,
      requestValidationModeMember: "ChecksumMode",
      "responseAlgorithms": ["CRC64NVME", "CRC32", "CRC32C", "SHA256", "SHA1", "SHA512", "MD5", "XXHASH64", "XXHASH3", "XXHASH128"]
    }),
    getSsecPlugin(config),
    getS3ExpiresMiddlewarePlugin(config)
  ];
}).s("AmazonS3", "GetObject", {}).n("S3Client", "GetObjectCommand").sc(GetObject$).build() {
  static {
    __name(this, "GetObjectCommand");
  }
};

// node_modules/@aws-sdk/client-s3/dist-es/commands/PutObjectCommand.js
init_client3();
init_index_browser();
var PutObjectCommand = class extends Command.classBuilder().ep({
  ...commonParams,
  Bucket: { type: "contextParams", name: "Bucket" },
  Key: { type: "contextParams", name: "Key" }
}).m(function(Command2, cs, config, o2) {
  return [
    getEndpointPlugin(config, Command2.getEndpointParameterInstructions()),
    getFlexibleChecksumsPlugin(config, {
      requestAlgorithmMember: { "httpHeader": "x-amz-sdk-checksum-algorithm", "name": "ChecksumAlgorithm" },
      requestChecksumRequired: false
    }),
    getCheckContentLengthHeaderPlugin(config),
    getThrow200ExceptionsPlugin(config),
    getSsecPlugin(config)
  ];
}).s("AmazonS3", "PutObject", {}).n("S3Client", "PutObjectCommand").sc(PutObject$).build() {
  static {
    __name(this, "PutObjectCommand");
  }
};

// node_modules/@aws-sdk/s3-request-presigner/dist-es/getSignedUrl.js
init_index_browser();
init_protocols();

// node_modules/@aws-sdk/s3-request-presigner/dist-es/constants.js
var UNSIGNED_PAYLOAD2 = "UNSIGNED-PAYLOAD";
var SHA256_HEADER2 = "X-Amz-Content-Sha256";

// node_modules/@aws-sdk/s3-request-presigner/dist-es/presigner.js
var S3RequestPresigner = class {
  static {
    __name(this, "S3RequestPresigner");
  }
  signer;
  constructor(options) {
    const resolvedOptions = {
      service: options.signingName || options.service || "s3",
      uriEscapePath: options.uriEscapePath || false,
      applyChecksum: options.applyChecksum || false,
      ...options
    };
    this.signer = new SignatureV4MultiRegion(resolvedOptions);
  }
  presign(requestToSign, { unsignableHeaders = /* @__PURE__ */ new Set(), hoistableHeaders = /* @__PURE__ */ new Set(), unhoistableHeaders = /* @__PURE__ */ new Set(), ...options } = {}) {
    this.prepareRequest(requestToSign, {
      unsignableHeaders,
      unhoistableHeaders,
      hoistableHeaders
    });
    return this.signer.presign(requestToSign, {
      expiresIn: 900,
      unsignableHeaders,
      unhoistableHeaders,
      ...options
    });
  }
  presignWithCredentials(requestToSign, credentials, { unsignableHeaders = /* @__PURE__ */ new Set(), hoistableHeaders = /* @__PURE__ */ new Set(), unhoistableHeaders = /* @__PURE__ */ new Set(), ...options } = {}) {
    this.prepareRequest(requestToSign, {
      unsignableHeaders,
      unhoistableHeaders,
      hoistableHeaders
    });
    return this.signer.presignWithCredentials(requestToSign, credentials, {
      expiresIn: 900,
      unsignableHeaders,
      unhoistableHeaders,
      ...options
    });
  }
  prepareRequest(requestToSign, { unsignableHeaders = /* @__PURE__ */ new Set(), unhoistableHeaders = /* @__PURE__ */ new Set(), hoistableHeaders = /* @__PURE__ */ new Set() } = {}) {
    unsignableHeaders.add("content-type");
    Object.keys(requestToSign.headers).map((header) => header.toLowerCase()).filter((header) => header.startsWith("x-amz-server-side-encryption")).forEach((header) => {
      if (!hoistableHeaders.has(header)) {
        unhoistableHeaders.add(header);
      }
    });
    requestToSign.headers[SHA256_HEADER2] = UNSIGNED_PAYLOAD2;
    const currentHostHeader = requestToSign.headers.host;
    const port = requestToSign.port;
    const expectedHostHeader = `${requestToSign.hostname}${requestToSign.port != null ? ":" + port : ""}`;
    if (!currentHostHeader || currentHostHeader === requestToSign.hostname && requestToSign.port != null) {
      requestToSign.headers.host = expectedHostHeader;
    }
  }
};

// node_modules/@aws-sdk/s3-request-presigner/dist-es/getSignedUrl.js
var getSignedUrl = /* @__PURE__ */ __name(async (client, command, options = {}) => {
  let s3Presigner;
  let region;
  if (typeof client.config.endpointProvider === "function") {
    const endpointV2 = await getEndpointFromInstructions(command.input, command.constructor, client.config);
    const authScheme = endpointV2.properties?.authSchemes?.[0];
    if (authScheme?.name === "sigv4a") {
      region = authScheme?.signingRegionSet?.join(",");
    } else {
      region = authScheme?.signingRegion;
    }
    s3Presigner = new S3RequestPresigner({
      ...client.config,
      signingName: authScheme?.signingName,
      region: /* @__PURE__ */ __name(async () => region, "region")
    });
  } else {
    s3Presigner = new S3RequestPresigner(client.config);
  }
  const presignInterceptMiddleware = /* @__PURE__ */ __name((next, context) => async (args) => {
    const { request } = args;
    if (!HttpRequest.isInstance(request)) {
      throw new Error("Request to be presigned is not an valid HTTP request.");
    }
    delete request.headers["amz-sdk-invocation-id"];
    delete request.headers["amz-sdk-request"];
    delete request.headers["x-amz-user-agent"];
    let presigned2;
    const presignerOptions = {
      ...options,
      signingRegion: options.signingRegion ?? context["signing_region"] ?? region,
      signingService: options.signingService ?? context["signing_service"]
    };
    if (context.s3ExpressIdentity) {
      presigned2 = await s3Presigner.presignWithCredentials(request, context.s3ExpressIdentity, presignerOptions);
    } else {
      presigned2 = await s3Presigner.presign(request, presignerOptions);
    }
    return {
      response: {},
      output: {
        $metadata: { httpStatusCode: 200 },
        presigned: presigned2
      }
    };
  }, "presignInterceptMiddleware");
  const middlewareName = "presignInterceptMiddleware";
  const clientStack = client.middlewareStack.clone();
  clientStack.addRelativeTo(presignInterceptMiddleware, {
    name: middlewareName,
    relation: "before",
    toMiddleware: "awsAuthMiddleware",
    override: true
  });
  const handler = command.resolveMiddleware(clientStack, client.config, {});
  const { output } = await handler({ input: command.input });
  const { presigned } = output;
  return formatUrl(presigned);
}, "getSignedUrl");

// src/api/upload.js
async function handleUploadUrlRequest(c2) {
  const token = c2.req.param("token");
  const { documentId, contentType } = await c2.req.json();
  if (!token || !documentId || !contentType) {
    return c2.json({ error: "Missing required fields" }, 400);
  }
  const db = getDbClient(c2.env);
  const tokenRes = await db.execute({
    sql: "SELECT lead_id, status FROM secure_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
    args: [token]
  });
  if (tokenRes.rows.length === 0) {
    return c2.json({ error: "Invalid or expired token" }, 403);
  }
  const { lead_id, status } = tokenRes.rows[0];
  if (status !== "active") {
    return c2.json({ error: "Token is locked or already used" }, 403);
  }
  const docRes = await db.execute({
    sql: "SELECT id, status, document_type FROM document_requests WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId]
  });
  if (docRes.rows.length === 0) {
    return c2.json({ error: "Document type not requested for this lead" }, 400);
  }
  const doc = docRes.rows[0];
  if (doc.status === "received") {
    return c2.json({ error: "Document already uploaded" }, 400);
  }
  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${c2.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: c2.env.R2_AK_id,
      secretAccessKey: c2.env.R2_SAK
    }
  });
  const leadRes = await db.execute({
    sql: "SELECT name FROM leads WHERE id = ?",
    args: [lead_id]
  });
  const clientNameRaw = leadRes.rows.length > 0 && leadRes.rows[0].name ? leadRes.rows[0].name : "Client";
  const clientName = clientNameRaw.replace(/[^a-zA-Z0-9]/g, "_");
  const fileKey = `${lead_id}/${clientName}_${doc.document_type}`;
  const command = new PutObjectCommand({
    Bucket: "lekho-documents",
    Key: fileKey,
    ContentType: contentType
  });
  try {
    const uploadUrl = await getSignedUrl(S3, command, { expiresIn: 300 });
    await db.execute({
      sql: "UPDATE document_requests SET s3_key = ? WHERE id = ?",
      args: [fileKey, doc.id]
    });
    return c2.json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("Failed to generate presigned URL", err);
    return c2.json({ error: "Failed to generate upload URL" }, 500);
  }
}
__name(handleUploadUrlRequest, "handleUploadUrlRequest");

// src/api/failures.js
async function logSystemFailure(db, errorType, leadId, details) {
  try {
    const id = crypto.randomUUID();
    const detailsStr = typeof details === "object" ? JSON.stringify(details) : String(details);
    await db.execute({
      sql: "INSERT INTO system_failures (id, error_type, lead_id, details) VALUES (?, ?, ?, ?)",
      args: [id, errorType, leadId, detailsStr]
    });
  } catch (err) {
    console.error("Failed to write to system_failures:", err);
  }
}
__name(logSystemFailure, "logSystemFailure");

// src/api/webhook.js
async function sendWhatsAppMessage(phone, text, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Webhook WhatsApp Send Error:", JSON.stringify(data));
    const details = data.error?.error_data?.details || "";
    throw new Error(`${data.error?.message || "Failed to send WhatsApp message from webhook"}${details ? " | Details: " + details : ""}`);
  }
}
__name(sendWhatsAppMessage, "sendWhatsAppMessage");
async function handleWebhookVerify(c2) {
  const mode = c2.req.query("hub.mode");
  const token = c2.req.query("hub.verify_token");
  const challenge = c2.req.query("hub.challenge");
  if (mode === "subscribe" && token === c2.env.WHATSAPP_VERIFY_TOKEN) {
    return c2.text(challenge);
  }
  return c2.text("Forbidden", 403);
}
__name(handleWebhookVerify, "handleWebhookVerify");
async function handleWebhookEvent(c2) {
  const body = await c2.req.json();
  const env = c2.env;
  const db = getDbClient(env);
  try {
    console.log("INCOMING WEBHOOK:", JSON.stringify(body, null, 2));
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;
    if (statuses && statuses.length > 0) {
      const statusObj = statuses[0];
      const recipientId = statusObj.recipient_id;
      const status = statusObj.status;
      console.log(`WHATSAPP STATUS UPDATE: Number=${recipientId}, Status=${status}`);
      await db.execute({
        sql: "UPDATE leads SET whatsapp_delivery_status = ? WHERE phone_number = ? OR phone_number = ?",
        args: [status, recipientId, "91" + recipientId]
      });
    }
    if (messages && messages.length > 0) {
      const message = messages[0];
      const fromPhone = message.from;
      const leadRes = await db.execute({
        sql: "SELECT id, name FROM leads WHERE phone_number = ?",
        args: [fromPhone]
      });
      if (leadRes.rows.length > 0) {
        const lead = leadRes.rows[0];
        const tokenRes = await db.execute({
          sql: "SELECT token FROM secure_tokens WHERE lead_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
          args: [lead.id]
        });
        const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;
        let msg = `Hello ${lead.name || "there"}! We noticed you messaged us. `;
        if (token) {
          const uploadLink = `${env.FRONTEND_URL || "https://lekho-edge.shahaaryan-milan-mst20.workers.dev"}/upload.html?t=${token}`;
          msg += `You have an active document upload request open. Please upload your documents securely here: ${uploadLink}`;
        } else {
          msg += `You are registered with us, but there are no active document upload requests at the moment. Please contact your CA directly if you need to submit new files!`;
        }
        await sendWhatsAppMessage(fromPhone, msg, env);
      } else {
        const msg = `Hello! Thank you for reaching out to Lekho Secure Document portal. It looks like you don't have an active portal link set up yet. Please contact your Chartered Accountant (CA) to get invited to submit your documents securely.`;
        await sendWhatsAppMessage(fromPhone, msg, env);
      }
    }
    return c2.text("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook processing error:", err);
    try {
      await logSystemFailure(db, "webhook_error", null, err.message || err);
    } catch (e2) {
    }
    return c2.text("ERROR", 500);
  }
}
__name(handleWebhookEvent, "handleWebhookEvent");

// src/api/ocr.js
async function handleUploadComplete(c2) {
  const token = c2.req.param("token");
  const { documentId } = await c2.req.json();
  if (!token || !documentId) return c2.json({ error: "Missing fields" }, 400);
  const db = getDbClient(c2.env);
  const tokenRes = await db.execute({
    sql: "SELECT lead_id FROM secure_tokens WHERE token = ? AND status = 'active'",
    args: [token]
  });
  if (tokenRes.rows.length === 0) return c2.json({ error: "Invalid token" }, 403);
  const lead_id = tokenRes.rows[0].lead_id;
  await db.execute({
    sql: "UPDATE document_requests SET status = 'received' WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId]
  });
  await db.execute({
    sql: "UPDATE leads SET last_updated = datetime('now') WHERE id = ?",
    args: [lead_id]
  });
  const docRes = await db.execute({
    sql: "SELECT id, s3_key, document_type FROM document_requests WHERE lead_id = ? AND id = ?",
    args: [lead_id, documentId]
  });
  if (docRes.rows.length === 0 || !docRes.rows[0].s3_key) return c2.json({ success: true });
  const s3Key = docRes.rows[0].s3_key;
  const docTypeString = docRes.rows[0].document_type;
  c2.executionCtx.waitUntil(runGeminiOcr(s3Key, docTypeString, docRes.rows[0].id, c2.env, db));
  return c2.json({ success: true });
}
__name(handleUploadComplete, "handleUploadComplete");
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i2 = 0; i2 < len; i2++) {
    binary += String.fromCharCode(bytes[i2]);
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function runGeminiOcr(s3Key, targetId, docId, env, db) {
  try {
    const S3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_AK_id,
        secretAccessKey: env.R2_SAK
      }
    });
    const getRes = await S3.send(new GetObjectCommand({ Bucket: "lekho-documents", Key: s3Key }));
    const arrayBuffer = await getRes.Body.transformToByteArray();
    const base64Data = arrayBufferToBase64(arrayBuffer);
    const mimeType = getRes.ContentType || "image/jpeg";
    const isBankStatement = String(targetId).startsWith("bank_statement");
    const docTypeLabel = isBankStatement ? "Bank Statement" : String(targetId).includes("pan") ? "PAN Card" : "Aadhaar Card";
    let extraInstructions = "";
    if (isBankStatement) {
      extraInstructions = "For Bank Statements, ONLY extract 'Statement period start' and 'Statement period end'. DO NOT extract individual transactions or balance information.";
    }
    const promptText = `You are an expert document parser. The user was requested to upload a **${docTypeLabel}**. 
First, verify if the uploaded image is actually a ${docTypeLabel}. 
If it is NOT, set "anomaly" to true and provide an "anomalyReason". 
If it IS the correct document, extract the requested fields. ${extraInstructions} Ensure dates are formatted as DD/MM/YYYY.
Return a rigid JSON structure EXACTLY like this:
{
  "anomaly": boolean,
  "anomalyReason": "string (or null)",
  "fields": {
    "key": "value"
  }
}`;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inline_data: { data: base64Data, mime_type: mimeType } },
            { text: promptText }
          ]
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });
    if (!geminiRes.ok) throw new Error("Gemini API error");
    const geminiData = await geminiRes.json();
    let rawText = geminiData.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
    let parsed = {};
    try {
      parsed = JSON.parse(rawText);
    } catch (e2) {
    }
    const newStatus = parsed.anomaly ? "flagged" : "received";
    await db.execute({
      sql: "UPDATE document_requests SET ocr_payload = ?, status = ? WHERE id = ?",
      args: [rawText, newStatus, docId]
    });
    if (parsed.anomaly) {
      const leadLookup = await db.execute({
        sql: "SELECT lead_id FROM document_requests WHERE id = ?",
        args: [docId]
      });
      const leadId = leadLookup.rows[0]?.lead_id || null;
      await logSystemFailure(db, "ocr_anomaly", leadId, {
        document_id: docId,
        anomaly_reason: parsed.anomalyReason,
        fields: parsed.fields
      });
    }
  } catch (err) {
    console.error("OCR execution failed on edge:", err);
    let leadId = null;
    try {
      const leadLookup = await db.execute({
        sql: "SELECT lead_id FROM document_requests WHERE id = ?",
        args: [docId]
      });
      leadId = leadLookup.rows[0]?.lead_id || null;
    } catch (e2) {
    }
    await logSystemFailure(db, "ocr_processing", leadId, err.message || err);
    try {
      await db.execute({
        sql: "UPDATE document_requests SET status = 'failed' WHERE id = ?",
        args: [docId]
      });
    } catch (dbErr) {
      console.error("Failed to update status to failed:", dbErr);
    }
  }
}
__name(runGeminiOcr, "runGeminiOcr");

// src/api/leads.js
async function sendWhatsAppMessage2(phone, text, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("WhatsApp Error:", JSON.stringify(data));
    const details = data.error?.error_data?.details || "";
    throw new Error(`${data.error?.message || "Failed to send WhatsApp message"}${details ? " | Details: " + details : ""}`);
  }
}
__name(sendWhatsAppMessage2, "sendWhatsAppMessage");
async function sendWhatsAppTemplate(phone, templateName, name, token, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                parameter_name: "name",
                text: name || "Client"
              },
              {
                type: "text",
                parameter_name: "caname",
                text: env.FIRM_NAME || "Mishra & Associates"
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                parameter_name: "token",
                text: `upload.html?t=${token}`
              }
            ]
          }
        ]
      }
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("WhatsApp Template Error:", JSON.stringify(data));
    const details = data.error?.error_data?.details || "";
    throw new Error(`${data.error?.message || "Failed to send WhatsApp template message"}${details ? " | Details: " + details : ""}`);
  }
}
__name(sendWhatsAppTemplate, "sendWhatsAppTemplate");
async function handleCreateLead(c2) {
  const body = await c2.req.json();
  let phone = body.phone;
  if (phone && phone.length === 10) {
    phone = "91" + phone;
  }
  const name = body.name || "";
  const requiredDocIds = body.requiredDocIds || [];
  const requiredDocCounts = body.requiredDocCounts || {};
  for (const [base, count] of Object.entries(requiredDocCounts)) {
    for (let i2 = 1; i2 <= count; i2++) {
      requiredDocIds.push(`${base}_${i2}`);
    }
  }
  const env = c2.env;
  if (!phone || requiredDocIds.length === 0) {
    return c2.json({ error: "Phone number and at least one document are required." }, 400);
  }
  try {
    const db = getDbClient(env);
    const existing = await db.execute({
      sql: "SELECT id FROM leads WHERE phone_number = ?",
      args: [phone]
    });
    if (existing.rows.length > 0) {
      return c2.json({ error: "A client with this phone number already exists." }, 400);
    }
    const leadId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.execute({
      sql: "INSERT INTO leads (id, phone_number, name, status, created_at, last_updated) VALUES (?, ?, ?, 'In Progress', datetime('now'), datetime('now'))",
      args: [leadId, phone, name]
    });
    await db.execute({
      sql: "INSERT INTO secure_tokens (token, lead_id, expires_at) VALUES (?, ?, ?)",
      args: [token, leadId, expiresAt.toISOString()]
    });
    for (const doc of requiredDocIds) {
      await db.execute({
        sql: "INSERT INTO document_requests (id, lead_id, document_type, status) VALUES (?, ?, ?, 'pending')",
        args: [crypto.randomUUID(), leadId, doc]
      });
    }
    const uploadLink = `${env.FRONTEND_URL}/upload.html?t=${token}`;
    const msg = `Hello ${name}! Your professional has requested documents. Please upload them securely here: ${uploadLink}

*Note: This link expires in 7 days and is locked to your device once clicked.*`;
    let whatsappWarning = null;
    try {
      if (env.WHATSAPP_NEW_LEAD_TEMPLATE) {
        await sendWhatsAppTemplate(phone, env.WHATSAPP_NEW_LEAD_TEMPLATE, name, token, env);
      } else {
        await sendWhatsAppMessage2(phone, msg, env);
      }
    } catch (waErr) {
      console.error("WhatsApp Delivery Failed:", waErr);
      whatsappWarning = "Lead created, but WhatsApp message could not be sent.";
      await logSystemFailure(db, "whatsapp_delivery", leadId, waErr.message || waErr);
      try {
        await db.execute({
          sql: "UPDATE leads SET whatsapp_delivery_status = 'failed' WHERE id = ?",
          args: [leadId]
        });
      } catch (dbErr) {
        console.error("Failed to update lead whatsapp delivery status in DB:", dbErr);
      }
    }
    return c2.json({ success: true, leadId, token, whatsappWarning });
  } catch (err) {
    console.error("Failed to create lead:", err);
    return c2.json({ error: "Failed to create request." }, 500);
  }
}
__name(handleCreateLead, "handleCreateLead");
async function handleGetLeads(c2) {
  const db = getDbClient(c2.env);
  const leadsRes = await db.execute(`
    SELECT leads.*, secure_tokens.token as upload_token 
    FROM leads 
    LEFT JOIN secure_tokens ON leads.id = secure_tokens.lead_id 
    ORDER BY leads.created_at DESC
  `);
  const leads = leadsRes.rows;
  const docsRes = await db.execute("SELECT * FROM document_requests");
  const formattedLeads = leads.map((row, index) => {
    const leadDocs = docsRes.rows.filter((d2) => d2.lead_id === row.id);
    const requiredDocIds = leadDocs.map((d2) => d2.document_type);
    const documentsState = {};
    leadDocs.forEach((d2) => {
      documentsState[d2.document_type] = {
        status: d2.status,
        link: d2.s3_key ? `/api/documents/${d2.s3_key}` : null,
        ocr: d2.ocr_payload ? JSON.parse(d2.ocr_payload) : null
      };
    });
    const allReceived = requiredDocIds.length > 0 && leadDocs.every((d2) => d2.status === "received");
    const displayStatus = allReceived ? "Completed" : "In Progress";
    return {
      rowIndex: index,
      // Old frontend uses this for identifying rows
      dbId: row.id,
      name: row.name,
      phone: row.phone_number,
      status: displayStatus,
      requiredDocIds,
      documentsState,
      needsFollowUp: row.needs_follow_up === 1,
      followUpNote: row.follow_up_note,
      lastUpdated: row.last_updated ? row.last_updated.replace(" ", "T") + "Z" : null,
      token: row.upload_token,
      whatsappDeliveryStatus: row.whatsapp_delivery_status
    };
  });
  const summary = {
    total: formattedLeads.length,
    inProgress: formattedLeads.filter((l2) => l2.status === "In Progress").length,
    completed: formattedLeads.filter((l2) => l2.status === "Completed").length,
    followUpDue: formattedLeads.filter((l2) => l2.needsFollowUp).length
  };
  return c2.json({ leads: formattedLeads, summary });
}
__name(handleGetLeads, "handleGetLeads");
async function handleFollowUp(c2) {
  const db = getDbClient(c2.env);
  const id = c2.req.param("id");
  try {
    await db.execute({
      sql: "UPDATE leads SET last_updated = datetime('now') WHERE id = ?",
      args: [id]
    });
    return c2.json({ success: true });
  } catch (e2) {
    return c2.json({ error: "Failed to send follow up" }, 500);
  }
}
__name(handleFollowUp, "handleFollowUp");
async function handleRejectDocument(c2) {
  const db = getDbClient(c2.env);
  const { leadId, documentId } = await c2.req.json();
  if (!leadId || !documentId) return c2.json({ error: "Missing fields" }, 400);
  try {
    await db.execute({
      sql: "UPDATE document_requests SET status = 'pending', s3_key = NULL, ocr_payload = NULL WHERE lead_id = ? AND document_type = ?",
      args: [leadId, documentId]
    });
    return c2.json({ success: true });
  } catch (err) {
    console.error(err);
    return c2.json({ error: "Database error" }, 500);
  }
}
__name(handleRejectDocument, "handleRejectDocument");
async function handleDocumentCatalog(c2) {
  const catalog = [
    { id: "pan", label: "PAN Card" },
    { id: "aadhaar", label: "Aadhaar Card" },
    { id: "bank_statement", label: "Bank Statement (Primary)", allowMultiple: true, maxCount: 12 },
    { id: "form16", label: "Form 16" },
    { id: "itr", label: "ITR Acknowledgment" }
  ];
  return c2.json({ documentCatalog: catalog });
}
__name(handleDocumentCatalog, "handleDocumentCatalog");
async function handleDeleteLead(c2) {
  const db = getDbClient(c2.env);
  const id = c2.req.param("id");
  try {
    await db.execute({
      sql: "DELETE FROM document_requests WHERE lead_id = ?",
      args: [id]
    });
    await db.execute({
      sql: "DELETE FROM secure_tokens WHERE lead_id = ?",
      args: [id]
    });
    await db.execute({
      sql: "DELETE FROM leads WHERE id = ?",
      args: [id]
    });
    return c2.json({ success: true });
  } catch (e2) {
    console.error("Failed to delete lead:", e2);
    return c2.json({ error: "Failed to delete lead." }, 500);
  }
}
__name(handleDeleteLead, "handleDeleteLead");
async function handleEditLead(c2) {
  const db = getDbClient(c2.env);
  const id = c2.req.param("id");
  try {
    const body = await c2.req.json();
    let { name, phone, requiredDocIds = [], requiredDocCounts = {} } = body;
    if (phone && phone.length === 10) phone = "91" + phone;
    const existingDocsRes = await db.execute({
      sql: "SELECT document_type, status FROM document_requests WHERE lead_id = ?",
      args: [id]
    });
    const existingDocs = existingDocsRes.rows;
    const incomingBaseTypes = new Set(Object.keys(requiredDocCounts));
    const incomingIds = new Set(requiredDocIds);
    for (const doc of existingDocs) {
      const isMulti = doc.document_type.match(/_[0-9]+_[0-9]+$/);
      let isRemoved = false;
      if (isMulti) {
        const base = doc.document_type.replace(/_[0-9]+_[0-9]+$/, "");
        if (!incomingBaseTypes.has(base)) {
          isRemoved = true;
        }
      } else {
        if (!incomingIds.has(doc.document_type)) {
          isRemoved = true;
        }
      }
      if (isRemoved && doc.status !== "pending") {
        return c2.json({ error: "Cannot remove documents that have already been submitted." }, 400);
      }
    }
    await db.execute({
      sql: "UPDATE leads SET name = ?, phone_number = ?, last_updated = datetime('now') WHERE id = ?",
      args: [name, phone, id]
    });
    await db.execute({
      sql: "DELETE FROM document_requests WHERE lead_id = ? AND status = 'pending'",
      args: [id]
    });
    const currentNonPending = new Set(existingDocs.filter((d2) => d2.status !== "pending").map((d2) => d2.document_type));
    const docsToInsert = [];
    for (const docId of requiredDocIds) {
      if (!currentNonPending.has(docId)) docsToInsert.push(docId);
    }
    for (const [base, count] of Object.entries(requiredDocCounts)) {
      for (let i2 = 1; i2 <= count; i2++) {
        const docId = `${base}_${id}_${i2}`;
        if (!currentNonPending.has(docId)) docsToInsert.push(docId);
      }
    }
    for (const docId of docsToInsert) {
      await db.execute({
        sql: "INSERT INTO document_requests (id, lead_id, document_type, status) VALUES (?, ?, ?, 'pending')",
        args: [crypto.randomUUID(), id, docId]
      });
    }
    return c2.json({ success: true });
  } catch (e2) {
    console.error("handleEditLead error:", e2);
    return c2.json({ error: "Failed to update lead" }, 500);
  }
}
__name(handleEditLead, "handleEditLead");

// node_modules/hono/dist/utils/encode.js
var decodeBase64 = /* @__PURE__ */ __name((str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  const half = binary.length / 2;
  for (let i2 = 0, j2 = binary.length - 1; i2 <= half; i2++, j2--) {
    bytes[i2] = binary.charCodeAt(i2);
    bytes[j2] = binary.charCodeAt(j2);
  }
  return bytes;
}, "decodeBase64");

// node_modules/hono/dist/utils/basic-auth.js
var CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/;
var USER_PASS_REGEXP = /^([^:]*):(.*)$/;
var utf8Decoder = new TextDecoder();
var auth = /* @__PURE__ */ __name((req) => {
  const match2 = CREDENTIALS_REGEXP.exec(req.headers.get("Authorization") || "");
  if (!match2) {
    return void 0;
  }
  let userPass = void 0;
  try {
    userPass = USER_PASS_REGEXP.exec(utf8Decoder.decode(decodeBase64(match2[1])));
  } catch {
  }
  if (!userPass) {
    return void 0;
  }
  return { username: userPass[1], password: userPass[2] };
}, "auth");

// node_modules/hono/dist/utils/crypto.js
var sha256 = /* @__PURE__ */ __name(async (data) => {
  const algorithm = { name: "SHA-256", alias: "sha256" };
  const hash = await createHash(data, algorithm);
  return hash;
}, "sha256");
var createHash = /* @__PURE__ */ __name(async (data, algorithm) => {
  let sourceBuffer;
  if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
    sourceBuffer = data;
  } else {
    if (typeof data === "object") {
      data = JSON.stringify(data);
    }
    sourceBuffer = new TextEncoder().encode(String(data));
  }
  if (crypto && crypto.subtle) {
    const buffer = await crypto.subtle.digest(
      {
        name: algorithm.name
      },
      sourceBuffer
    );
    const hash = Array.prototype.map.call(new Uint8Array(buffer), (x2) => ("00" + x2.toString(16)).slice(-2)).join("");
    return hash;
  }
  return null;
}, "createHash");

// node_modules/hono/dist/utils/buffer.js
var constantTimeEqualString = /* @__PURE__ */ __name((a2, b2) => {
  const aLen = a2.length;
  const bLen = b2.length;
  const maxLen = Math.max(aLen, bLen);
  let out = aLen ^ bLen;
  for (let i2 = 0; i2 < maxLen; i2++) {
    const aChar = i2 < aLen ? a2.charCodeAt(i2) : 0;
    const bChar = i2 < bLen ? b2.charCodeAt(i2) : 0;
    out |= aChar ^ bChar;
  }
  return out === 0;
}, "constantTimeEqualString");
var timingSafeEqualString = /* @__PURE__ */ __name(async (a2, b2, hashFunction) => {
  if (!hashFunction) {
    hashFunction = sha256;
  }
  const [sa, sb] = await Promise.all([hashFunction(a2), hashFunction(b2)]);
  if (sa == null || sb == null || typeof sa !== "string" || typeof sb !== "string") {
    return false;
  }
  const hashEqual = constantTimeEqualString(sa, sb);
  const originalEqual = constantTimeEqualString(a2, b2);
  return hashEqual && originalEqual;
}, "timingSafeEqualString");
var timingSafeEqual = /* @__PURE__ */ __name(async (a2, b2, hashFunction) => {
  if (typeof a2 === "string" && typeof b2 === "string") {
    return timingSafeEqualString(a2, b2, hashFunction);
  }
  if (!hashFunction) {
    hashFunction = sha256;
  }
  const [sa, sb] = await Promise.all([hashFunction(a2), hashFunction(b2)]);
  if (!sa || !sb || typeof sa !== "string" || typeof sb !== "string") {
    return false;
  }
  return timingSafeEqualString(sa, sb);
}, "timingSafeEqual");

// node_modules/hono/dist/middleware/basic-auth/index.js
var basicAuth = /* @__PURE__ */ __name((options, ...users) => {
  const usernamePasswordInOptions = "username" in options && "password" in options;
  const verifyUserInOptions = "verifyUser" in options;
  if (!(usernamePasswordInOptions || verifyUserInOptions)) {
    throw new Error(
      'basic auth middleware requires options for "username and password" or "verifyUser"'
    );
  }
  if (!options.realm) {
    options.realm = "Secure Area";
  }
  if (!options.invalidUserMessage) {
    options.invalidUserMessage = "Unauthorized";
  }
  if (usernamePasswordInOptions) {
    users.unshift({ username: options.username, password: options.password });
  }
  return /* @__PURE__ */ __name(async function basicAuth2(ctx, next) {
    const requestUser = auth(ctx.req.raw);
    if (requestUser) {
      if (verifyUserInOptions) {
        if (await options.verifyUser(requestUser.username, requestUser.password, ctx)) {
          if (options.onAuthSuccess) {
            await options.onAuthSuccess(ctx, requestUser.username);
          }
          await next();
          return;
        }
      } else {
        for (const user of users) {
          const [usernameEqual, passwordEqual] = await Promise.all([
            timingSafeEqual(user.username, requestUser.username, options.hashFunction),
            timingSafeEqual(user.password, requestUser.password, options.hashFunction)
          ]);
          if (usernameEqual && passwordEqual) {
            if (options.onAuthSuccess) {
              await options.onAuthSuccess(ctx, requestUser.username);
            }
            await next();
            return;
          }
        }
      }
    }
    const status = 401;
    const headers = {
      "WWW-Authenticate": 'Basic realm="' + options.realm?.replace(/"/g, '\\"') + '"'
    };
    const responseMessage = typeof options.invalidUserMessage === "function" ? await options.invalidUserMessage(ctx) : options.invalidUserMessage;
    const res = typeof responseMessage === "string" ? new Response(responseMessage, { status, headers }) : new Response(JSON.stringify(responseMessage), {
      status,
      headers: {
        ...headers,
        "content-type": "application/json"
      }
    });
    throw new HTTPException(status, { res });
  }, "basicAuth2");
}, "basicAuth");

// src/api/admin.js
async function handleGetAdminFailures(c2) {
  const db = getDbClient(c2.env);
  try {
    const res = await db.execute(`
      SELECT sf.*, l.name as lead_name, l.phone_number as lead_phone
      FROM system_failures sf
      LEFT JOIN leads l ON sf.lead_id = l.id
      ORDER BY sf.created_at DESC
      LIMIT 100
    `);
    return c2.json({ success: true, failures: res.rows });
  } catch (err) {
    console.error("Failed to fetch failures:", err);
    return c2.json({ error: "Failed to load failure logs." }, 500);
  }
}
__name(handleGetAdminFailures, "handleGetAdminFailures");
async function handleDeleteAdminFailure(c2) {
  const db = getDbClient(c2.env);
  const id = c2.req.param("id");
  try {
    await db.execute({
      sql: "DELETE FROM system_failures WHERE id = ?",
      args: [id]
    });
    return c2.json({ success: true });
  } catch (err) {
    return c2.json({ error: "Failed to delete failure log." }, 500);
  }
}
__name(handleDeleteAdminFailure, "handleDeleteAdminFailure");
async function handleClearAllFailures(c2) {
  const db = getDbClient(c2.env);
  try {
    await db.execute("DELETE FROM system_failures");
    return c2.json({ success: true });
  } catch (err) {
    return c2.json({ error: "Failed to clear failure logs." }, 500);
  }
}
__name(handleClearAllFailures, "handleClearAllFailures");
async function handleGetAdminDashboard(c2) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lekho - Failures & Observability Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --panel: #111827;
      --panel-border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --red: #f87171;
      --red-bg: rgba(248, 113, 113, 0.1);
      --yellow: #fbbf24;
      --yellow-bg: rgba(251, 191, 36, 0.1);
      --green: #34d399;
      --green-bg: rgba(52, 211, 153, 0.1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
      line-height: 1.5;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2.5rem;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 1.5rem;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .btn {
      font-family: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.625rem 1.25rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary {
      background-color: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background-color: var(--primary-hover);
    }

    .btn-danger {
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .btn-danger:hover {
      background-color: rgba(239, 68, 68, 0.3);
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2.5rem;
    }

    .card {
      background-color: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .card-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .card-val {
      font-size: 2.25rem;
      font-weight: 700;
    }

    .card-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }

    /* Logs Table */
    .logs-panel {
      background-color: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      overflow: hidden;
    }

    .panel-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-title {
      font-weight: 600;
      font-size: 1.125rem;
    }

    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.875rem;
    }

    th {
      background-color: rgba(255, 255, 255, 0.02);
      padding: 1rem 1.5rem;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--panel-border);
    }

    td {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--panel-border);
      vertical-align: top;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-error {
      background-color: var(--red-bg);
      color: var(--red);
    }

    .badge-warning {
      background-color: var(--yellow-bg);
      color: var(--yellow);
    }

    .code-block {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      background-color: rgba(0, 0, 0, 0.3);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #e5e7eb;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .timestamp {
      color: var(--text-muted);
      font-size: 0.8125rem;
    }

    .empty-state {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state svg {
      color: rgba(255, 255, 255, 0.1);
      margin-bottom: 1rem;
    }

    .client-info {
      font-weight: 500;
    }
    
    .client-phone {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background-color: var(--primary);
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
      font-weight: 500;
      display: none;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(1rem); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Lekho System Failures</h1>
        <div class="subtitle">Real-time observability and delivery issue tracking</div>
      </div>
      <div style="display: flex; gap: 1rem;">
        <button class="btn btn-primary" onclick="loadFailures()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh Logs
        </button>
        <button class="btn btn-danger" onclick="clearAll()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Clear All Logs
        </button>
      </div>
    </header>

    <div class="summary-grid">
      <div class="card">
        <div class="card-label">Total Errors Logged</div>
        <div class="card-val" id="count-total">0</div>
        <div class="card-sub">Active system failure events</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--red);">
        <div class="card-label">WhatsApp Failures</div>
        <div class="card-val" id="count-whatsapp">0</div>
        <div class="card-sub">Outbound notifications blocked</div>
      </div>
      <div class="card" style="border-left: 3px solid var(--yellow);">
        <div class="card-label">OCR Failures & Anomalies</div>
        <div class="card-val" id="count-ocr">0</div>
        <div class="card-sub">Flagged files or extraction crashes</div>
      </div>
    </div>

    <div class="logs-panel">
      <div class="panel-header">
        <div class="panel-title">Active Failures</div>
        <span class="badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); text-transform: none; font-size: 0.75rem;" id="log-status">Updated just now</span>
      </div>
      <div class="table-container">
        <table id="logs-table">
          <thead>
            <tr>
              <th style="width: 15%">Timestamp</th>
              <th style="width: 15%">Category</th>
              <th style="width: 20%">Client Impacted</th>
              <th style="width: 40%">Error Details</th>
              <th style="width: 10%; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="logs-body">
            <tr>
              <td colspan="5" class="empty-state">Loading failure logs...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="toast" id="toast">Notification text</div>

  <script>
    function showToast(msg) {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.style.display = "block";
      setTimeout(() => {
        toast.style.display = "none";
      }, 3000);
    }

    async function loadFailures() {
      document.getElementById("log-status").textContent = "Refreshing...";
      try {
        const res = await fetch("/api/admin/failures");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch logs");
        
        renderLogs(data.failures);
      } catch (err) {
        showToast("Error loading logs: " + err.message);
      }
    }

    function renderLogs(failures) {
      const body = document.getElementById("logs-body");
      
      // Update stats
      document.getElementById("count-total").textContent = failures.length;
      document.getElementById("count-whatsapp").textContent = failures.filter(f => f.error_type === "whatsapp_delivery").length;
      document.getElementById("count-ocr").textContent = failures.filter(f => f.error_type.startsWith("ocr")).length;
      
      if (failures.length === 0) {
        body.innerHTML = \`
          <tr>
            <td colspan="5" class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem;"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              <div>No system failures logged. All systems operating normally!</div>
            </td>
          </tr>
        \`;
        document.getElementById("log-status").textContent = "No active issues";
        return;
      }

      body.innerHTML = "";
      failures.forEach(f => {
        const tr = document.createElement("tr");
        
        // Timestamp
        const dateCell = document.createElement("td");
        dateCell.className = "timestamp";
        const date = new Date(f.created_at);
        dateCell.textContent = date.toLocaleString();
        tr.appendChild(dateCell);
        
        // Category Badge
        const catCell = document.createElement("td");
        const badge = document.createElement("span");
        if (f.error_type === "whatsapp_delivery") {
          badge.className = "badge badge-error";
          badge.textContent = "WhatsApp";
        } else if (f.error_type === "ocr_anomaly") {
          badge.className = "badge badge-warning";
          badge.textContent = "Anomaly";
        } else {
          badge.className = "badge badge-warning";
          badge.textContent = "OCR Error";
        }
        catCell.appendChild(badge);
        tr.appendChild(catCell);
        
        // Lead/Client
        const clientCell = document.createElement("td");
        if (f.lead_name) {
          clientCell.innerHTML = \`
            <div class="client-info">\${escapeHtml(f.lead_name)}</div>
            <div class="client-phone">\${escapeHtml(f.lead_phone)}</div>
          \`;
        } else {
          clientCell.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No specific client</span>';
        }
        tr.appendChild(clientCell);
        
        // Details Code Block
        const detailsCell = document.createElement("td");
        const pre = document.createElement("pre");
        pre.className = "code-block";
        
        let detailsText = f.details;
        try {
          const parsed = JSON.parse(f.details);
          detailsText = JSON.stringify(parsed, null, 2);
        } catch(e) {}
        
        pre.textContent = detailsText;
        detailsCell.appendChild(pre);
        tr.appendChild(detailsCell);
        
        // Actions
        const actionCell = document.createElement("td");
        actionCell.style.textAlign = "right";
        const btn = document.createElement("button");
        btn.className = "btn btn-danger";
        btn.style.padding = "4px 8px";
        btn.style.fontSize = "0.75rem";
        btn.textContent = "Resolve";
        btn.onclick = () => deleteFailure(f.id);
        actionCell.appendChild(btn);
        tr.appendChild(actionCell);
        
        body.appendChild(tr);
      });

      const now = new Date();
      document.getElementById("log-status").textContent = "Last updated: " + now.toLocaleTimeString();
    }

    async function deleteFailure(id) {
      if (!confirm("Mark this issue as resolved and delete log?")) return;
      try {
        const res = await fetch(\`/api/admin/failures/\${id}\`, { method: "DELETE" });
        if (!res.ok) throw new Error("API failed");
        showToast("Logged issue resolved.");
        loadFailures();
      } catch (err) {
        showToast("Error resolving issue.");
      }
    }

    async function clearAll() {
      if (!confirm("Are you sure you want to permanently clear all failure logs?")) return;
      try {
        const res = await fetch("/api/admin/failures", { method: "DELETE" });
        if (!res.ok) throw new Error("API failed");
        showToast("All system logs cleared.");
        loadFailures();
      } catch(err) {
        showToast("Error clearing logs.");
      }
    }

    function escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    window.onload = loadFailures;
  <\/script>
</body>
</html>
  `;
  return c2.html(html);
}
__name(handleGetAdminDashboard, "handleGetAdminDashboard");

// src/index.js
var app = new Hono2();
app.use("*", cors());
app.get("/", (c2) => c2.text("Lekho Edge API Running"));
app.get("/api/session/:token", handleSessionRequest);
app.post("/api/upload-url/:token", handleUploadUrlRequest);
app.post("/api/upload-complete/:token", handleUploadComplete);
app.get("/api/leads", handleGetLeads);
app.post("/api/leads", handleCreateLead);
app.patch("/api/leads/:id", handleEditLead);
app.delete("/api/leads/:id", handleDeleteLead);
app.post("/api/leads/:id/follow-up/send-template", handleFollowUp);
app.get("/api/document-catalog", handleDocumentCatalog);
app.post("/api/reject-document", handleRejectDocument);
app.get("/api/documents/*", async (c2) => {
  const key = c2.req.path.substring("/api/documents/".length);
  try {
    const object = await c2.env.DOCUMENT_BUCKET.get(key);
    if (!object) {
      return c2.text("File not found", 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (!headers.get("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }
    return new Response(object.body, { headers });
  } catch (e2) {
    console.error("Error fetching from R2:", e2);
    return c2.text("Internal Error", 500);
  }
});
app.get("/api/webhook", handleWebhookVerify);
app.post("/api/webhook", handleWebhookEvent);
app.use("/dd", async (c2, next) => {
  const auth2 = basicAuth({
    username: c2.env.ADMIN_USERNAME || "admin",
    password: c2.env.ADMIN_PASSWORD || "admin123"
  });
  return auth2(c2, next);
});
app.use("/api/admin*", async (c2, next) => {
  const auth2 = basicAuth({
    username: c2.env.ADMIN_USERNAME || "admin",
    password: c2.env.ADMIN_PASSWORD || "admin123"
  });
  return auth2(c2, next);
});
app.get("/dd", handleGetAdminDashboard);
app.get("/api/admin/failures", handleGetAdminFailures);
app.delete("/api/admin/failures", handleClearAllFailures);
app.delete("/api/admin/failures/:id", handleDeleteAdminFailure);
app.get("/api/admin/debug-template", async (c2) => {
  const token = c2.env.WHATSAPP_ACCESS_TOKEN;
  try {
    const meRes = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,accounts&access_token=${token}`);
    const meData = await meRes.json();
    return c2.json({ meData });
  } catch (err) {
    return c2.json({ error: err.message }, 500);
  }
});
var index_default = app;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
