(function () {
    var VIZ = {};
    var camera, renderer, controls, scene = new THREE.Scene();
    var width = window.innerWidth, height = window.innerHeight;
    var mapWidth = 1200, mapHeight = 800, format = d3.format(".1f");
    var r = Math.PI / 2;
    var d = 250;
    var pos = [[d, 0, 0], [-d, 0, 0], [0, d, 0], [0, -d, 0], [0, 0, d], [0, 0, -d]];
    var rot = [[0, r, 0], [0, -r, 0], [-r, 0, 0], [r, 0, 0], [0, 0, 0], [0, 0, 0]];
    var stationsById = {};
    var routesById = {};
    let tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0) // d3 tooltip for inspecting single points

    camera = new THREE.PerspectiveCamera(40, width / height, 1, 10000);
    camera.position.z = 1500;
    // camera.setLens(30);

    VIZ.drawElements = function (mapList, data, london, stations, connections, routes, overlay) {
        VIZ.count = mapList.length;

        // console.log(mapList)

        var elements = d3.selectAll('.map-div')
            .data(mapList).enter()
            .append("div")
            .attr("class", "map-div")
            .each(function (d, i) {

                // //title
                // d3.select(this).append("div")
                //     .attr("class", "map-title")
                //     .html(function (d) {
                //         // var text = " - 2010 Incidence Rates by State";
                //         var text = "";
                //
                //         return d.title + text;
                //     });

                // d3.select(this).append("div")
                //     .attr("class", "map-caption")
                //     .html("2010 CDC Cancer Data");

                d3.select(this).append("div")
                    .attr("class", function (d) {
                        return d.elem + " map-rollover";
                    });

                d3.select(this).append("svg")
                    .attr("class", "map-container")
                    .attr("width", mapWidth + "px")
                    .attr("height", mapHeight + "px")
                    .attr("id", function (d) {
                        return d.elem;
                    });

                // VIZ.drawMap.call(this, data, d.elem);
                VIZ.drawMap2.call(this, i, london, d.elem, stations, connections, routes, overlay);

            });

        // elements.each(console.log(d))

        elements.each(setPositionData);
        elements.each(addToScene);
    };

    VIZ.drawMap2 = function (i, london, elemID, stations, connections, routes, overlayData) {

        var merged = topojson.merge(london, london.objects.wpc.geometries);

        //Setting up D3
        var projection = d3.geoAlbers()
            .rotate([0, 0])
            .fitSize([mapWidth, mapHeight], merged);

        var path = d3.geoPath().projection(projection);

        let svg = d3.select("#" + elemID);

        var outline = svg.append("g")
            .attr("class", "outline-group")
            .datum(merged)
            .append("path")
            .attr("d", path);

        var constituencies = svg.append("g")
            .attr("class", "constituencies")
            .selectAll("path")
            .data(topojson.feature(london, london.objects.wpc).features)
            .enter().append("path")
            .attr("class", "constituency")
            .attr("d", path)
            .on("mouseover", function (d) {
                // fix this so it works for constituency's with multiple geographical regions
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);

                let coords = d3.mouse(this);
                // console.log(coords);


                tooltip.html(`${d.properties.PCON13NM}<br/>${d.properties.PCON13CDO}`)
                    .style("left", (coords[1]) + "px")
                    .style("top", (coords[0] - 28) + "px");
            })
            .on("mouseout", function () {

                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);

            });

        //stations

        //tube map
        if (i === 0) {
            //add the tube map to the first layer only
            //hide layer vis
            let layer = d3.select(this);
            layer.style('background-color', 'transparent');
            let outlineGroup = layer.select('.outline-group').classed('noBG path', true);

            // create an object index by station id
            stations.forEach(function (s) {
                stationsById[s.id] = s;
                s.conns = [];
                s.display_name = (s.display_name == 'NULL') ? null : s.display_name;
                s.rail = parseInt(s.rail, 10);
                s.totalLines = parseInt(s.total_lines, 10);
                s.latitude = parseFloat(s.latitude);
                s.longitude = parseFloat(s.longitude);
            });

            // link lines
            connections.forEach(function (c) {

                c.station1 = stationsById[c.station1];
                c.station2 = stationsById[c.station2];
                c.station1.conns.push(c);
                c.station2.conns.push(c);
                c.time = parseInt(c.time, 10);
            });

            // Organizing lines
            routes.forEach(function (r) {
                routesById[r.line] = r;
            });


            var tubeMap = svg.append("g")
                .attr("class", "tube-map");

            // need to clean this up a bit
            var routes = tubeMap.append("g")
                .attr("class", "routes")
                .selectAll("line")
                .data(connections)
                .enter().append("line")
                .attr("class", "route")
                .attr("stroke", function (d) {
                    return "#" + routesById[d.line].colour;
                })
                .attr("stroke-linecap", 'round')
                .attr("x1", function (d) {
                    return projection([d.station1.longitude, d.station1.latitude])[0];
                })
                .attr("y1", function (d) {
                    return projection([d.station1.longitude, d.station1.latitude])[1];
                })
                .attr("x2", function (d) {
                    return projection([d.station2.longitude, d.station2.latitude])[0];
                })
                .attr("y2", function (d) {
                    return projection([d.station2.longitude, d.station2.latitude])[1];
                });


            var interchanges = tubeMap.append("g")
                .attr("class", "changes")
                .selectAll("circle")
                .data(stations.filter(function (d) {
                    return d.totalLines - d.rail > 1;
                }))
                .enter().append("circle")
                .attr("class", "interchange")
                .attr("cx", function (d) {
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr("cy", function (d) {
                    return projection([d.longitude, d.latitude])[1];
                })
                .attr("r", 2);

            var stations = tubeMap.append("g")
                .attr("class", "stations")
                .selectAll("circle")
                .data(stations)
                .enter().append("circle")
                .attr("class", "station")
                .attr("id", function (d) {
                    return 'station' + d.id
                })
                .attr("cx", function (d) {
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr("cy", function (d) {
                    return projection([d.longitude, d.latitude])[1];
                })
                .attr("r", 2)
                .attr("title", function (d) {
                    return d.name
                });

            constituencies.on("mouseover", function (d) {
                // fix this so it works for constituency's with multiple geographical regions
                var region = d.geometry.coordinates[0];
                var regionCentroid = projection(d3.polygonCentroid(region));

                d3.select(this).style("opacity", 0.2);

                var counter = 0;

                d3.selectAll(".station")
                    .attr("r", function (d) {
                        if (d3.polygonContains(region, [d.longitude, d.latitude])) {
                            counter++;
                            return 5;
                        } else {
                            return 2;
                        }
                    })

                // move this text out using d3-annotations
                d3.select(this.parentNode).append("text")
                    .attr("x", regionCentroid[0])
                    .attr("y", regionCentroid[1])
                    .attr("text-anchor", "middle")
                    .text(counter)
            })
                .on("mouseout", function () {
                    d3.select(this).style("opacity", 0.05);
                    d3.selectAll(".station").attr("r", 2);

                    d3.select(this.parentNode).select("text")
                        .remove();
                })

            d3.select(this).append("div")
                .attr("class", "map-caption")
                .html("Tube Map and Stations");

        }

        //overlay

        if (i === 2) {

            // console.log(overlayData);

            overlayData.forEach(function (d) {
                d.latitude = parseFloat(d.latitude);
                d.longitude = parseFloat(d.longitude);
            });

            let layer = d3.select(this);
            layer.style('background-color', 'transparent');
            let outlineGroup = layer.select('.outline-group').classed('noBG path', true);

            let overlayContainer = svg.append("g")
                .attr("class", "overlay");

            let overlay = overlayContainer.append("g")
                .attr("class", "overlay")
                .selectAll("circle")
                .data(overlayData)
                .enter().append("circle")
                .attr("class", "overlay")
                // .attr("id", function (d) {
                //     return 'station' + d.id
                // })
                .attr("cx", function (d) {
                    return projection([d.longitude, d.latitude])[0];
                })
                .attr("cy", function (d) {
                    return projection([d.longitude, d.latitude])[1];
                })
                .attr("r", 2)


            d3.select(this).append("div")
                .attr("class", "map-caption")
                .html("Electric Car Charge Points");
        }

        // d3.select("#" + elemID).selectAll("path")
        //     .data(data.features)
        //     .enter().append("svg:path")
        //     .attr("d", path)
        //     .style("fill", function (d) {
        //         var v = d.properties.data[elemID].inc;
        //         return v < 0 ? 'grey' : scale(v);
        //     })
        //     .on("mouseover", function (d) {
        //         d3.event.preventDefault();
        //         var state = d.properties.name;
        //         var irate = d.properties.data[elemID].inc;
        //         var selector = "." + elemID + ".map-rollover";
        //         d3.select(selector)
        //             .html(state + " - " + (irate < 0 ? "No Data" : format(irate)));
        //     })
        //     .on("mouseout", function (d) {
        //         d3.event.preventDefault();
        //         var selector = "." + elemID + ".map-rollover";
        //         d3.select(selector).html("");
        //     });

        // drawLegend(scale, elemID);
    };

    var addToScene = function (d) {
        var object = new THREE.CSS3DObject(this);
        object.position = d.random.position;
        object.name = d.elem;
        scene.add(object);
    };

    var setPositionData = function (d, i) {
        var vector, phi, theta;
        var random, sphere, grid;

        random = new THREE.Object3D();
        random.position.x = Math.random() * 4000 - 2000;
        random.position.y = Math.random() * 4000 - 2000;
        random.position.z = Math.random() * 4000 - 2000;
        d['random'] = random;

        sphere = new THREE.Object3D();
        phi = Math.acos(-1 + ( 2 * i ) / VIZ.count);
        theta = Math.sqrt(VIZ.count * Math.PI) * phi;
        vector = new THREE.Vector3();
        sphere.position.x = 1200 * Math.cos(theta) * Math.sin(phi);
        sphere.position.y = 1200 * Math.sin(theta) * Math.sin(phi);
        sphere.position.z = 1200 * Math.cos(phi);
        vector.copy(sphere.position).multiplyScalar(2);
        sphere.lookAt(vector);
        d['sphere'] = sphere;

        grid = new THREE.Object3D();
        grid.position.x = (( i % 5 ) * 1050) - 2000;
        grid.position.y = ( -( Math.floor(i / 5) % 5 ) * 650 ) + 800;
        grid.position.z = 0;
        d['grid'] = grid;

        let interval = height / 3; //height/segments
        stack = new THREE.Object3D();
        stack.position.x = 0;
        stack.position.y = (i * interval) - height / 2;
        stack.position.z = 0;
        stack.rotation.fromArray(rot[2]);
        d['stack'] = stack;
    };

    var drawLegend = function (scale, elemID) {
        var grades = [scale.domain()[0]].concat(scale.quantiles());
        var labels = [], from, to;

        for (var i = 0; i < grades.length; i++) {
            from = format(grades[i]);
            to = grades[i + 1] ? format(grades[i + 1]) : false;
            labels.push(from + (to ? '-' + to : '+'));
        }

        var svg = d3.select("#" + elemID);

        svg.append('text').text("Quantiles:")
            .attr("transform", "translate(625, 190)");

        var legend = svg.selectAll(".legend")
            .data(grades)
            .enter().append("g")
            .attr("class", "legend")
            .attr("transform", function (d, i) {
                return "translate(0," + ((i * 20) + 200) + ")";
            });

        legend.append("rect")
            .attr("x", mapWidth - 10)
            .attr("width", 10)
            .attr("height", 10)
            .style("fill", function (d, i) {
                return scale(grades[i]);
            })
            .style("stroke", "grey");

        legend.append("text")
            .attr("x", mapWidth - 12)
            .attr("y", 5)
            .attr("dy", ".30em")
            .style("text-anchor", "end")
            .text(function (d, i) {
                return labels[i];
            });
    }

    VIZ.render = function () {
        renderer.render(scene, camera);
    };

    VIZ.transform = function (layout) {
        var duration = 1000;

        TWEEN.removeAll();

        scene.children.forEach(function (object) {

            // console.log(object.element.__data__);
            // console.log(object);

            var newPos = object.element.__data__[layout].position;

            var coords = new TWEEN.Tween(object.position)
                .to({x: newPos.x, y: newPos.y, z: newPos.z}, duration)
                .easing(TWEEN.Easing.Sinusoidal.InOut)
                .start();

            var newRot = object.element.__data__[layout].rotation;
            var rotate = new TWEEN.Tween(object.rotation)
                .to({x: newRot.x, y: newRot.y, z: newRot.z}, duration)
                .easing(TWEEN.Easing.Sinusoidal.InOut)
                .start();
        });

        var update = new TWEEN.Tween(this)
            .to({}, duration)
            .onUpdate(VIZ.render)
            .start();
    };

    VIZ.animate = function () {
        requestAnimationFrame(VIZ.animate);
        TWEEN.update();
        controls.update();
    };

    renderer = new THREE.CSS3DRenderer();
    renderer.setSize(width, height);
    renderer.domElement.style.position = 'absolute';
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new THREE.TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 0.5;
    controls.minDistance = 100;
    controls.maxDistance = 6000;
    controls.addEventListener('change', VIZ.render);

    VIZ.resetControls = controls.reset;

    VIZ.onWindowResize = function () {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        VIZ.render();
    }

    window.VIZ = VIZ;
}());