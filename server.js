const express = require('express');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const axios = require('axios');

// Tumhara Render Backend URL
const API_URL = process.env.STUDENT_API_URL || 'https://student-api-oqkt.onrender.com/api';

const app = express();
app.use(express.json());

// Health check route (Render ke liye zaroori hai)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// MCP Endpoint
app.post('/mcp', async (req, res) => {
  try {
    const server = new McpServer({
      name: 'student-mcp-server',
      version: '1.0.0',
    });

    // Tool 1: Saare students dekhne ke liye
    server.registerTool(
      'list_students',
      { 
        description: 'Get all students from the Student Management System', 
        inputSchema: {} 
      },
      async () => {
        const { data } = await axios.get(`${API_URL}/students`);
        return {
          content: [{ type: 'text', text: `Total ${data.count} students:\n${JSON.stringify(data.data, null, 2)}` }],
        };
      }
    );

    // Tool 2: Naya student add karne ke liye
    server.registerTool(
      'add_student',
      {
        description: 'Add a new student to the system',
        inputSchema: {
          studentId: z.string().describe('Unique student ID like ST101'),
          name: z.string().describe('Full name'),
          email: z.string().email().describe('Email address'),
          department: z.string().describe('Department (Computer Science, Electrical, Civil, Mechanical)'),
          semester: z.number().min(1).max(8).describe('Semester 1-8'),
          contact: z.string().optional().describe('10 digit contact'),
        },
      },
      async (data) => {
        const { data: response } = await axios.post(`${API_URL}/students`, data);
        return { content: [{ type: 'text', text: `✅ Added: ${response.data.name} (${response.data.studentId})` }] };
      }
    );

    // Tool 3: Student search karne ke liye
    server.registerTool(
      'search_student',
      {
        description: 'Search student by name or ID',
        inputSchema: { query: z.string() },
      },
      async ({ query }) => {
        const { data } = await axios.get(`${API_URL}/students`);
        const results = data.data.filter(s => 
          s.name.toLowerCase().includes(query.toLowerCase()) || 
          s.studentId.toLowerCase().includes(query.toLowerCase())
        );
        if (results.length === 0) return { content: [{ type: 'text', text: `No student found for: ${query}` }] };
        return { content: [{ type: 'text', text: `Found ${results.length}:\n${JSON.stringify(results, null, 2)}` }] };
      }
    );

    // Transport setup
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP Error:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
});