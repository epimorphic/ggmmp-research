/*
    Generates a list of distances between
    (1) the LatLng coordinates recorded in local memory for the location, and
    (2) the LatLng coordinates in the panorama metadata pulled from Google,
    for locations with a locked panoID.

    This is needed to guide the determination of a threshold to detect
    whether an imported location has likely had its LatLng coordinates
    manually changed.
*/

let famous = [];
// let i_made_this_smile = [];
// const HALF_PI = Math.PI / 2;
const DEG_TO_RAD = Math.PI / 180;


async function record_distances(loc_local) {
    await svs.getPanoramaById(loc_local.panoId).then(
        (response) => {
            const loc_goog = response.data.location;
          	const lat1 = loc_local.lat * DEG_TO_RAD,
                  lat2 = loc_goog.latLng.lat() * DEG_TO_RAD,
                  diff_lng = (loc_local.lng - loc_goog.latLng.lng()) * DEG_TO_RAD;

            /*
                Haversine distance formula from Wikipedia, derived by taking
                the dot product in 3D. Stability for close-by points
                should be good per theory.
            */
            const d_hav = 2 * Math.asin(
                Math.sqrt(
                    Math.sin((lat1 - lat2) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((diff_lng) / 2) ** 2
                )
            );
            famous.push({
                unitSphereDistance: d_hav,
                sphericalEarthDistance: d_hav * 6371009,
                loc: loc_local
            });

            /*
                Attempt at a distance formula using 3D rotations instead.
                Bad stability because for two close-by points we would be
                evaluating asin of an input very close to 1.
            */
            // const zen1 = HALF_PI - lat1;
            // const d_i_made_this_smile = HALF_PI - Math.asin(
            //     Math.sin(zen1) * Math.cos(lat2) * Math.cos(diff_lng) + Math.cos(zen1) * Math.sin(lat2)
            // );
            // i_made_this_smile.push([
            //     d_i_made_this_smile,
            //     d_i_made_this_smile * 6371009,
            //     loc_local
            // ]);
        }
    );
}

function generateDistancesList() {
    const locsIterator = locs.values();
    let progressCounter = 0;

    /*
        Use multiple tasks, since waiting for the server response is
        the biggest time sink here
    */
    const numParallelTasks = 4;
    let tasksDoneCounter = 0;

    for(let i = 0; i < numParallelTasks; i++) checkNextLocTask();

    async function checkNextLocTask() {
        let nextResult = locsIterator.next();
        while(!nextResult.done) {
            progressCounter++;
            const loc_local = nextResult.value;
            if(loc_local.panoId) {
                await record_distances(loc_local);
                console.log(famous.length, `(${progressCounter}/${locs.size})`);
            }
            nextResult = locsIterator.next();
        }

        if(++tasksDoneCounter == numParallelTasks) {
            famous.sort(
                (a, b) => a.unitSphereDistance - b.unitSphereDistance
            );
            console.log(famous);
        }
    }
}

generateDistancesList();

