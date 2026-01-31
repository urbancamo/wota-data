┌─────────────────────────────────────────────────┬────────────────────────────────────────────────┐                                                                   
│                    Endpoint                     │                  Description                   │                                                                   
├─────────────────────────────────────────────────┼────────────────────────────────────────────────┤                                                                   
│ GET /data/api/summits                           │ Get all summits                                │                                                                   
├─────────────────────────────────────────────────┼────────────────────────────────────────────────┤                                                                   
│ GET /data/api/summits/geojson                   │ Get summits GeoJSON                            │                                                                   
├─────────────────────────────────────────────────┼────────────────────────────────────────────────┤                                                                   
│ GET /data/api/summits/:wotaid/activations       │ Get activations for a specific summit          │                                                                   
├─────────────────────────────────────────────────┼────────────────────────────────────────────────┤                                                                   
│ GET /data/api/summits/sota/:reference           │ Look up summit by SOTA reference (URL-encoded) │                                                                   
├─────────────────────────────────────────────────┼────────────────────────────────────────────────┤                                                                   
│ GET /data/api/summits/sota/:association/:region │ Look up summit by SOTA reference (path-based)  │                                                                   
└─────────────────────────────────────────────────┴────────────────────────────────────────────────┘                                                                   
The POST /data/api/summits/validate endpoint was already public.
