const [Graphic, GraphicsLayer, Sketch, route, RouteParameters, FeatureSet, SimpleLineSymbol, SimpleMarkerSymbol] =
        await $arcgis.import([
          "@arcgis/core/Graphic.js",
          "@arcgis/core/layers/GraphicsLayer.js",
          "@arcgis/core/widgets/Sketch.js",
          "@arcgis/core/rest/route.js",
          "@arcgis/core/rest/support/RouteParameters.js",
          "@arcgis/core/rest/support/FeatureSet.js",
          "@arcgis/core/symbols/SimpleLineSymbol.js",
          "@arcgis/core/symbols/SimpleMarkerSymbol.js",
        ]);


      const routeUrl =
        "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

      const viewElement = document.querySelector("arcgis-map");

      // Dedicated layers
      const stopsLayer = new GraphicsLayer({ id: "stopsLayer" });
      const barriersLayer = new GraphicsLayer({ id: "barriersLayer" });
      const routeLayer = new GraphicsLayer({ id: "routeLayer" });

      // Add layers to the underlying map view when it's ready
      await viewElement.viewOnReady();
      viewElement.view.map.addMany([stopsLayer, barriersLayer, routeLayer]);

      // UI bindings
      const toolMode = document.querySelector('#toolMode');
      const solveBtn = document.querySelector('#solveBtn');
      const clearBtn = document.querySelector('#clearBtn');

      // Sketch for barrier drawing (polyline)
      const sketch = new Sketch({
        layer: barriersLayer,
        view: viewElement.view,
        creationMode: "update",
        visibleElements: { selectionTools: { point: false, polygon: false, rectangle: false, circle: false } },
      });
      // Place the sketch widget off-screen; we control creation programmatically
      sketch.container = document.createElement('div');

      // Style barriers when completed
      sketch.on("create", (event) => {
        if (event.state === "complete" && event.graphic) {
          event.graphic.symbol = new SimpleLineSymbol({ color: [200, 0, 0, 1], width: 5 });
        }
      });

      // Convert ESC into "finish" so barriers are not lost
      viewElement.view.on('key-down', (evt) => {
        const key = evt.key || evt.code;
        if (currentMode === 'barrier' && (key === 'Escape' || key === 'Esc')) {
          evt.stopPropagation();
          try { sketch.complete(); } catch (_) {}
        }
      });

      let currentMode = 'stop';
      toolMode?.addEventListener('calciteSegmentedControlChange', (e) => {
        currentMode = e.target.value;
      });

      viewElement.addEventListener("arcgisViewClick", async (event) => {
        const directionsNotice = document.querySelector("#directions-notice");

        if (currentMode === 'stop') {
          if (stopsLayer.graphics.length === 0) {
            addStop("origin", event.detail.mapPoint);
          } else if (stopsLayer.graphics.length === 1) {
            directionsNotice.open = false;
            addStop("destination", event.detail.mapPoint);
          } else {
            clearAll();
            directionsNotice.open = true;
            addStop("origin", event.detail.mapPoint);
          }
        } else if (currentMode === 'barrier') {
          // Start a polyline sketch from the click
          const created = await sketch.create("polyline", { mode: "click" });
          // created graphic is automatically added to barriersLayer
        }
      });

      function addStop(type, point) {
        const graphic = new Graphic({
          symbol: new SimpleMarkerSymbol({
            color: type === "origin" ? "white" : "black",
            size: "8px",
            outline: { color: "#333", width: 1 }
          }),
          geometry: point,
        });
        stopsLayer.add(graphic);
      }
      async function getRoute() {
        const routeParams = new RouteParameters({
          stops: new FeatureSet({
            features: stopsLayer.graphics.toArray(),
          }),
          polylineBarriers: new FeatureSet({
            // Use existing barrier graphics; default is restriction
            features: barriersLayer.graphics.toArray().map(g => new Graphic({
              geometry: g.geometry,
              attributes: { BarrierType: 0 }, // restriction
            })),
          }),
          returnDirections: true,
        });

        try {
          const response = await route.solve(routeUrl, routeParams);

          routeLayer.removeAll();
          if (response.routeResults.length === 0) {
            const directionsNotice = document.querySelector("#directions-notice");
            if (directionsNotice) {
              directionsNotice.open = true;
              directionsNotice.querySelector('[slot="message"]').textContent = 'No route found with current barriers. Try adjusting barriers or stops.';
            }
            return;
          }
          response.routeResults.forEach((result) => {
            result.route.symbol = new SimpleLineSymbol({
              color: [5, 150, 255],
              width: 3,
            });
            routeLayer.add(result.route);
          });

          if (response.routeResults.length > 0) {
            const directions = document.createElement("calcite-list");

            const features = response.routeResults[0].directions.features;
            features.forEach((feature, index) => {
              const direction = document.createElement("calcite-list-item");

              const step = document.createElement("span");
              step.innerText = `${index + 1}.`;
              step.slot = "content-start";
              step.style.marginLeft = "10px";
              direction.appendChild(step);

              direction.label = `${feature.attributes.text}`;
              direction.description = `${feature.attributes.length.toFixed(2)} miles`;
              directions.appendChild(direction);
            });
            document.querySelector("#directions-container").appendChild(directions);
          }

        } catch (error) {
          console.log(error);
        }
      }

      // Wire buttons
      solveBtn?.addEventListener('click', () => {
        if (stopsLayer.graphics.length >= 2) {
          getRoute();
        }
      });
      clearBtn?.addEventListener('click', () => {
        clearAll();
        document.querySelector("#directions-container").innerHTML = "";
        const directionsNotice = document.querySelector("#directions-notice");
        if (directionsNotice) directionsNotice.open = true;
      });

      function clearAll() {
        stopsLayer.removeAll();
        barriersLayer.removeAll();
        routeLayer.removeAll();
      }