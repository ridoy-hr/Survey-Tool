# HR.com Survey Tool Documentation

## Overview
The **HR.com Survey Tool** is a comprehensive, full-stack application designed for HR professionals to build, manage, and analyze custom surveys. It provides an end-to-end platform for gathering feedback, running employee assessments, and tracking real-time analytics.

## Core Features

### 1. Dashboard & Project Management
- **Centralized Hub**: View all your surveys in one place.
- **Categorization**: Filter projects by 'All', 'Recent', 'Starred', and 'Trash'.
- **Quick Actions**: Quickly copy, delete, restore, or view analytics for any given survey.
- **Global Analytics**: At-a-glance metrics showing total responses, completion rates, and status distributions across all workstreams.

### 2. Advanced Survey Builder
The builder interface is split into several intuitive tabs:
- **Questions**: Drag-and-drop interface to add and arrange questions. Supported types include:
  - Multiple Choice & Checkbox
  - Short Text (Input)
  - Rating & NPS (Net Promoter Score)
  - Matrix (Grid-based questions)
  - HTML (Custom blocks)
  - Page Breaks (Multi-page surveys)
- **Properties**: Configure individual question settings like "Required" toggles and programmatic "Alias" identifiers.
- **Design/Theme**: Customize the visual appearance of your survey to match brand guidelines.
- **Logic**: Setup routing and conditional logic between questions.
- **Thank You Page**: Dedicated builder for customizing the post-submission screen.

### 3. Sharing & Distribution
- **Tracking Links**: Generate unique, shareable URLs for different audiences.
- **Permissions**: Surveys can be shared with specific collaborators or kept private.

### 4. Results & Analytics
- **Real-time Tracking**: Monitor incoming responses instantly.
- **Completion Metrics**: View "Hits" vs "Completion Rate" to identify where users might drop off.
- **Data Export**: Built-in tools for exporting survey data to CSV, Excel, and PDF formats.

### 5. Administration
- **Admin Panel**: Exclusive access for administrators (e.g., `mridoy@hr.com`) to inspect global user activity, manage overarching platform settings, and review system-wide survey data.

## Technical Stack
- **Frontend**: React (18+) with Vite, Tailwind CSS for styling, and `motion/react` for smooth UI animations.
- **Backend & Database**: Firebase (Authentication & Firestore) for secure, real-time data synchronization.
- **Icons & UI**: `lucide-react` for iconography.

## Getting Started
1. **Sign In**: Access the platform using your authorized Google or HR.com account.
2. **Create**: Click the `+` button on the dashboard to initialize a new blank survey or start from a template.
3. **Build**: Add your questions, configure settings, and preview the live experience.
4. **Deploy**: Navigate to the 'Share' tab to generate your distribution link.

---
*Note: This documentation is maintained for the HR.com internal research platform.*
