export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OJIX Property Intelligence API',
    version: '0.1.0',
    description: 'REST API for OJIX Property Intelligence and Non-Litigation Law Intelligence.'
  },

  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server'
    }
  ],

  tags: [
    { name: 'Health', description: 'API health and readiness' },
    { name: 'Authentication', description: 'Authentication and user information' },
    { name: 'Properties', description: 'Property management and analysis' },
    { name: 'Locations', description: 'Shared Karnataka administrative reference hierarchy' },
    { name: 'Documents', description: 'Property document upload and extraction' }
  ],

  paths: {
    '/api/locations/districts': {
      get: { tags: ['Locations'], summary: 'List active districts', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Alphabetical district list' }, 401: { description: 'Authentication required' } } }
    },
    '/api/locations/taluks': {
      get: { tags: ['Locations'], summary: 'List active taluks in a district', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'districtId', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Alphabetical taluk list' }, 400: { description: 'Invalid districtId' }, 404: { description: 'District not found' } } }
    },
    '/api/locations/hoblis': {
      get: { tags: ['Locations'], summary: 'List active hoblis in a taluk', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'talukId', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Alphabetical hobli list' }, 400: { description: 'Invalid talukId' }, 404: { description: 'Taluk not found' } } }
    },
    '/api/locations/villages': {
      get: { tags: ['Locations'], summary: 'List active villages in a hobli', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'hobliId', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Alphabetical village list' }, 400: { description: 'Invalid hobliId' }, 404: { description: 'Hobli not found' } } }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health',
        responses: {
          200: { description: 'API is healthy' },
          503: { description: 'Database unavailable' }
        }
      }
    },

    '/healthz': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        responses: {
          200: { description: 'OK' }
        }
      }
    },

    '/readyz': {
      get: {
        tags: ['Health'],
        summary: 'Check API and MariaDB spatial readiness',
        responses: {
          200: { description: 'API is ready' },
          503: { description: 'API is not ready' }
        }
      }
    },

    '/api/auth/dummy-accounts': {
      get: {
        tags: ['Authentication'],
        summary: 'Get local dummy accounts',
        responses: {
          200: { description: 'Available local accounts' }
        }
      }
    },

    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login using local development account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: {
                    type: 'string',
                    example: 'owner@ojix.local'
                  },
                  uid: {
                    type: 'string',
                    example: 'user-owner'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Successful login' },
          401: { description: 'Invalid credentials' }
        }
      }
    },

    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current user' },
          401: { description: 'Unauthorized' }
        }
      }
    },

    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout',
        responses: {
          200: { description: 'Logged out successfully' }
        }
      }
    },

    '/api/overview': {
      get: {
        tags: ['Properties'],
        summary: 'Get property workspace overview',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Workspace overview' }
        }
      }
    },

    '/api/properties': {
      get: {
        tags: ['Properties'],
        summary: 'List properties',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Search property name, survey number, village or address'
          }
        ],
        responses: {
          200: { description: 'Property list' }
        }
      },

      post: {
        tags: ['Properties'],
        summary: 'Create a property',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Property'
              }
            }
          }
        },
        responses: {
          201: { description: 'Property created' },
          400: { description: 'Invalid property payload' }
        }
      }
    },

    '/api/properties/{id}': {
      get: {
        tags: ['Properties'],
        summary: 'Get property details',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          200: { description: 'Property details' },
          404: { description: 'Property not found' }
        }
      },

      patch: {
        tags: ['Properties'],
        summary: 'Update a property',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Property'
              }
            }
          }
        },
        responses: {
          200: { description: 'Property updated' }
        }
      }
    },

    '/api/properties/{id}/analyze': {
      post: {
        tags: ['Properties'],
        summary: 'Run property risk analysis',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }
        ],
        responses: {
          200: { description: 'Analysis completed' },
          404: { description: 'Property not found' }
        }
      }
    },

    '/api/properties/{id}/parcels': {
      get: {
        tags: ['Properties'],
        summary: 'List parcel and survey references for a property',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Parcel reference list' }, 404: { description: 'Property not found' } }
      },
      post: {
        tags: ['Properties'],
        summary: 'Add a parcel or survey reference to a property',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ParcelReference' } } } },
        responses: { 201: { description: 'Parcel reference created' }, 400: { description: 'Invalid parcel reference' }, 409: { description: 'Duplicate parcel reference' } }
      }
    },

    '/api/properties/{id}/parcels/{parcelId}': {
      delete: {
        tags: ['Properties'],
        summary: 'Delete a non-primary parcel reference',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'parcelId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: { 204: { description: 'Parcel reference deleted' }, 404: { description: 'Parcel reference not found' }, 409: { description: 'Primary parcel cannot be deleted' } }
      }
    },

    '/api/properties/{id}/documents': {
      post: {
        tags: ['Documents'],
        summary: 'Upload property documents',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary'
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Documents uploaded' },
          400: { description: 'No files received' }
        }
      }
    },

    '/api/properties/{id}/documents/{docId}/file': {
      get: {
        tags: ['Documents'],
        summary: 'View a document',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'docId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          200: { description: 'Document file' },
          404: { description: 'Document not found' }
        }
      }
    },

    '/api/properties/{id}/documents/{docId}/extract': {
      post: {
        tags: ['Documents'],
        summary: 'Extract information from a document',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'docId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  tokens: {
                    type: 'array',
                    items: { type: 'string' }
                  },
                  jsonPayload: { type: 'object' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Extraction completed' }
        }
      }
    },

    '/api/properties/{id}/documents/{docId}/fields': {
      patch: {
        tags: ['Documents'],
        summary: 'Review or override extracted document fields',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'docId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fieldPath: {
                    type: 'string',
                    example: 'parties.ownerName'
                  },
                  newValue: {
                    type: 'string'
                  },
                  rationale: {
                    type: 'string',
                    example: 'Verified against original document'
                  },
                  isVerified: {
                    type: 'boolean'
                  },
                  overrides: {
                    type: 'object'
                  }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Document fields updated' },
          400: { description: 'Invalid field update' }
        }
      }
    }
  },

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },

    schemas: {
      Property: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            example: 'Sample Property'
          },
          village: {
            type: 'string',
            example: 'Whitefield'
          },
          hobli: {
            type: 'string',
            example: 'Kundalahalli'
          },
          taluk: {
            type: 'string',
            example: 'Bengaluru East'
          },
          district: {
            type: 'string',
            example: 'Bengaluru Urban'
          },
          surveyNumber: {
            type: 'string',
            example: '123/4'
          },
          subdivision: {
            type: 'string',
            example: 'A'
          },
          extent: {
            type: 'string',
            example: '1200 Sq Ft'
          },
          address: {
            type: 'string',
            example: 'Bengaluru, Karnataka'
          },
          latitude: {
            type: 'number',
            nullable: true,
            example: 12.9716
          },
          longitude: {
            type: 'number',
            nullable: true,
            example: 77.5946
          },
          notes: {
            type: 'string'
          }
        }
      },
      ParcelReference: {
        type: 'object',
        required: ['village', 'surveyNumber'],
        properties: {
          district: { type: 'string', example: 'Bengaluru Urban' },
          taluk: { type: 'string', example: 'Bengaluru South' },
          hobli: { type: 'string', example: 'Begur' },
          village: { type: 'string', example: 'Arakere' },
          surveyNumber: { type: 'string', example: '34' },
          subdivision: { type: 'string', example: '2A' },
          extentRaw: { type: 'string', example: '15 guntas' },
          extentValue: { type: 'number', nullable: true, example: 15 },
          extentUnit: { type: 'string', enum: ['acre', 'gunta', 'sq_ft', 'sq_m', 'cent', 'hectare', ''] },
          sourceDescription: { type: 'string', example: 'RTC 2025-26' },
          factState: { type: 'string', enum: ['known', 'verified', 'disputed', 'unknown'], example: 'known' },
          notes: { type: 'string' }
        }
      }
    }
  }
};
