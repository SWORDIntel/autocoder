import { jest } from '@jest/globals';

// Mock the mongoose module
jest.unstable_mockModule('mongoose', () => ({
  default: {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    connection: {
      readyState: 0, // Initially disconnected
    },
    model: jest.fn(),
    Schema: jest.fn(),
  },
}));

// Mock the Memory model, which is the default export from its module
const mockMemoryModelInstance = {
    save: jest.fn().mockResolvedValue(true),
};
const mockMemoryModelStatic = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockResolvedValue({ file: 'test.js' }),
    sort: jest.fn().mockResolvedValue([]),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    findByIdAndDelete: jest.fn().mockResolvedValue({}),
};
// Merge static and instance methods for the mock
const MemoryMock = jest.fn().mockImplementation(() => mockMemoryModelInstance);
Object.assign(MemoryMock, mockMemoryModelStatic);

jest.unstable_mockModule('../../server/models/memory.js', () => ({
    default: MemoryMock,
}));

// Import the module to be tested
const MemoryManager = (await import('../../server/memoryManager.js')).default;
const mongoose = (await import('mongoose')).default;

describe('MemoryManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset readyState before each test
        mongoose.connection.readyState = 0;
    });

    describe('connect', () => {
        it('should connect to the database if not already connected', async () => {
            await MemoryManager.connect('mock-db-url');
            expect(mongoose.connect).toHaveBeenCalledWith('mock-db-url');
        });

        it('should not connect if already connected', async () => {
            mongoose.connection.readyState = 1; // Simulate connected state
            await MemoryManager.connect('mock-db-url');
            expect(mongoose.connect).not.toHaveBeenCalled();
        });

        it('should throw an error if connection fails', async () => {
            const connectError = new Error('Connection failed');
            mongoose.connect.mockRejectedValueOnce(connectError);
            // Use a try-catch block or `expect.rejects` for async functions
            await expect(MemoryManager.connect('mock-db-url')).rejects.toThrow(connectError);
        });
    });

    describe('disconnect', () => {
        it('should disconnect if connected', async () => {
            mongoose.connection.readyState = 1;
            await MemoryManager.disconnect();
            expect(mongoose.disconnect).toHaveBeenCalled();
        });

        it('should not disconnect if not connected', async () => {
            mongoose.connection.readyState = 0;
            await MemoryManager.disconnect();
            expect(mongoose.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('saveMemory', () => {
        it('should create and save a new memory', async () => {
            const memoryData = { project: 'p1', file: 'f1', code: 'c1', learnings: 'l1', tags: ['t1'] };
            await MemoryManager.saveMemory(memoryData);
            expect(MemoryMock).toHaveBeenCalledWith(memoryData);
            expect(mockMemoryModelInstance.save).toHaveBeenCalled();
        });
    });

    describe('searchMemories', () => {
        it('should perform a text search with the correct query', async () => {
            // This test verifies that the Mongoose `find` and `sort` methods are called with the correct parameters.
            await MemoryManager.searchMemories('search term', ['tag1']);

            const expectedSearchCriteria = {
                $text: { $search: 'search term' },
                tags: { $in: ['tag1'] },
            };
            const expectedSortCriteria = {
                score: { $meta: 'textScore' }
            };

            expect(MemoryMock.find).toHaveBeenCalledWith(
                expectedSearchCriteria,
                { score: { $meta: "textScore" } }
            );
            expect(MemoryMock.sort).toHaveBeenCalledWith(expectedSortCriteria);
        });
    });
});