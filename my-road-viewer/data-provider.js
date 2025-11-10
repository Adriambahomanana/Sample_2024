// Custom Data Provider for MapillaryJS
class CustomDataProvider extends mapillary.DataProviderBase {
    constructor(surveyData) {
        super(new mapillary.S2GeometryProvider());
        
        this.surveyData = surveyData;
        this.images = new Map();
        this.sequences = new Map();
        this.cells = new Map();
        
        this._processSurveyData();
    }
    
    _processSurveyData() {
        const frontImages = [];
        const rearImages = [];
        
        this.surveyData.forEach((point) => {
            const headingRad = (point.heading_front * Math.PI) / 180;
            const rearHeadingRad = ((point.heading_front + 180) % 360) * Math.PI / 180;
            
            const frontImage = this._createImageEnt(
                `point${point.id}_front`,
                'seq_front',
                point.lat,
                point.long,
                headingRad,
                point.front_width,
                point.front_height,
                `./images/${point.front}`,
                point.id
            );
            
            const rearImage = this._createImageEnt(
                `point${point.id}_rear`,
                'seq_rear',
                point.lat,
                point.long,
                rearHeadingRad,
                point.rear_width,
                point.rear_height,
                `./images/${point.rear}`,
                point.id
            );
            
            this.images.set(frontImage.id, frontImage);
            this.images.set(rearImage.id, rearImage);
            frontImages.push(frontImage);
            rearImages.push(rearImage);
        });
        
        this.sequences.set('seq_front', {
            id: 'seq_front',
            image_ids: frontImages.map(img => img.id)
        });
        
        this.sequences.set('seq_rear', {
            id: 'seq_rear',
            image_ids: rearImages.map(img => img.id)
        });
        
        const allImages = [...frontImages, ...rearImages];
        allImages.forEach(image => {
            const cellId = this._geometry.lngLatToCellId({
                lat: image.computed_geometry.lat,
                lng: image.computed_geometry.lng
            });
            if (!this.cells.has(cellId)) {
                this.cells.set(cellId, []);
            }
            this.cells.get(cellId).push(image);
        });
        
        console.log(`Processed ${this.images.size} images, ${this.sequences.size} sequences, ${this.cells.size} cells`);
    }
    
    _createImageEnt(id, sequenceId, lat, lng, headingRad, width, height, imageUrl, pointId) {
        return {
            id: id,
            sequence: { id: sequenceId },
            merge_id: 'sample_2024',
            computed_geometry: { lat: lat, lng: lng },
            geometry: { lat: lat, lng: lng },
            computed_rotation: [Math.PI / 2, 0, headingRad],
            camera_type: 'perspective',
            camera_parameters: [0.8, 0, 0],
            width: width,
            height: height,
            thumb: { id: `${id}_thumb`, url: imageUrl },
            mesh: { id: `${id}_mesh`, url: '' },
            cluster: { id: `${id}_cluster`, url: '' },
            captured_at: Date.now(),
            creator: { id: 'user', username: 'survey' },
            point_id: pointId
        };
    }
    
    getCoreImages(cellId) {
        const images = this.cells.has(cellId) ? this.cells.get(cellId) : [];
        console.log(`getCoreImages called for cell ${cellId}, returning ${images.length} images`);
        return Promise.resolve({ cell_id: cellId, images: images });
    }
    
    getImages(imageIds) {
        console.log(`getImages called for ${imageIds.length} images`);
        return Promise.resolve(imageIds.map(id => ({
            node: this.images.has(id) ? this.images.get(id) : null,
            node_id: id
        })));
    }
    
    getImageBuffer(url) {
        console.log(`getImageBuffer called for ${url}`);
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load image: ${url}`);
                }
                return response.arrayBuffer();
            })
            .catch(error => {
                console.error(`Error loading image ${url}:`, error);
                throw error;
            });
    }
    
    getSpatialImages(imageIds) {
        return this.getImages(imageIds);
    }
    
    getSequence(sequenceId) {
        console.log(`getSequence called for ${sequenceId}`);
        if (this.sequences.has(sequenceId)) {
            return Promise.resolve(this.sequences.get(sequenceId));
        }
        return Promise.reject(new Error(`Sequence ${sequenceId} not found`));
    }
    
    getCluster(url) {
        return Promise.resolve({ points: {}, reference: { lat: 0, lng: 0, alt: 0 } });
    }
    
    getMesh(url) {
        return Promise.resolve({ faces: [], vertices: [] });
    }
    
    getImageTiles(tiles) {
        return Promise.reject(new Error('Image tiles not supported'));
    }
}