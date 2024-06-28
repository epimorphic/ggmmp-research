function chooseSamples(locsIterator) {
    const progressIndicator = Object.assign(
        document.createElement("span"),
        {
            // id: "pano-dimension-locs-progress"
        }
    );
    document.getElementById("right-location").appendChild(progressIndicator);


    // Map (dimension, uploder) => representativePano
    const du2r = new Map();
    
    let panoCounter = 0;
    const total = locs.size;

    /*
        Use multiple tasks, since waiting for the server response is
        the biggest time sink here
    */
    const numParallelTasks = 4;
    let tasksDoneCounter = 0;

    for(let i = 0; i < numParallelTasks; i++) filterPanosTask();
    
    async function filterPanosTask() {

        while(true) {
            const result = locsIterator.next();
            if(result.done) break;
            progressIndicator.textContent = `${++panoCounter}/${total}`;
            const loc = result.value;
    
            let panoRequest;
            if(loc.panoId) {
                if(loc.panoId.length != 22) {
                    panoRequest = {
                        pano: loc.panoId
                    };
                }
                else {
                    continue;
                }
            }
            else {
                panoRequest = {
                    location: {
                        lat: loc.lat,
                        lng: loc.lng
                    }
                };
            }
    
            await svs.getPanorama(panoRequest).then(
                (response) => {
                    const panoData = response.data;
                    const panoId = panoData.location.pano;
                    if(panoId.length > 22) {
                        const worldSize = panoData.tiles.worldSize;
                        const key = JSON.stringify({
                            width: worldSize.width,
                            height: worldSize.height,
                            contributor: panoData.location.profileUrl.slice(31)
                        });
                        if(!du2r.has(key)) {
                            du2r.set(key, panoId);
                        }
                    }
                }
            ).catch(
                (failureReason) => {
                    // console.warn(failureReason);
                }
            )
        }

        if(++tasksDoneCounter == numParallelTasks) filteringDone();
    }

    function filteringDone() {
        viewingList = Array.from(du2r.entries()).map(
            ([key, panoId]) => {
                const panoData = JSON.parse(key);
                panoData.panoId = panoId;
                return panoData;
            }
        ).sort(
            (a, b) => {
                const widthDiff = a.width - b.width;
                if(widthDiff != 0) return widthDiff;
                return a.height - b.height;
            }
        );

        const json = new Blob([JSON.stringify(viewingList)]);
        browser.downloads.download({
            url: URL.createObjectURL(json),
            filename: "pano-size-contributor-samples.json"
        });
    
        interactiveSlideshow(viewingList);
    }
}

function interactiveSlideshow(viewingList) {
    let panoCounter = 0;
    const total = viewingList.length;
    const panoDimensionTextBox = document.getElementById("pano-size");
    const nextButton = Object.assign(
        document.createElement("button"),
        {
            textContent: "Next »"
        }
    );
    nextButton.addEventListener(
        "click",
        (ev) => {
            ev.target.disabled = true;
            const loc = viewingList[panoCounter++];
            pano.setPano(loc.panoId);
            pano.setVisible(true);
            progressIndicator.textContent = `${panoCounter}/${total}`;
            if(loc.width == 2 * loc.height) {
                panoDimensionTextBox.style.backgroundColor = null;
            }
            else {
                panoDimensionTextBox.style.backgroundColor = "pink";
            }
            if(panoCounter < total) ev.target.disabled = false;
        }
    )
    document.getElementById("right-location").appendChild(nextButton);
}

chooseSamples(locs.values());