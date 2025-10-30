const [Graphic, route, RouteParameters, FeatureSet, SimpleLineSymbol, SimpleMarkerSymbol] =
        await $arcgis.import([
          "@arcgis/core/Graphic.js",
          "@arcgis/core/rest/route.js",
          "@arcgis/core/rest/support/RouteParameters.js",
          "@arcgis/core/rest/support/FeatureSet.js",
          "@arcgis/core/symbols/SimpleLineSymbol.js",
          "@arcgis/core/symbols/SimpleMarkerSymbol.js",
        ]);


      const routeUrl =
        "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

      const viewElement = document.querySelector("arcgis-map");
      viewElement.addEventListener("arcgisViewClick", (event) => {

        const directionsNotice = document.querySelector("#directions-notice");
        if (viewElement.view.graphics.length === 0) {
          addGraphic("origin", event.detail.mapPoint);
        } else if (viewElement.view.graphics.length === 1) {
          directionsNotice.open = false;
          addGraphic("destination", event.detail.mapPoint);

          getRoute();

        } else {
          viewElement.view.graphics.removeAll();
          directionsNotice.open = true;
          document.querySelector("#directions-container").innerHTML = "";
          addGraphic("origin", event.detail.mapPoint);
        }

      });

      function addGraphic(type, point) {
        const graphic = new Graphic({
          symbol: new SimpleMarkerSymbol({
            color: type === "origin" ? "white" : "black",
            size: "8px",
          }),
          geometry: point,
        });
        viewElement.view.graphics.add(graphic);
      }
      async function getRoute() {
        const routeParams = new RouteParameters({
          stops: new FeatureSet({
            features: viewElement.view.graphics.toArray(),
          }),

          returnDirections: true,

        });

        try {
          const response = await route.solve(routeUrl, routeParams);

          response.routeResults.forEach((result) => {
            result.route.symbol = new SimpleLineSymbol({
              color: [5, 150, 255],
              width: 3,
            });
            viewElement.view.graphics.add(result.route);
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
        }}