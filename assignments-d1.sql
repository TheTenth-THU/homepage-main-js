-- Create the Semesters table
DROP TABLE IF EXISTS Semesters;
CREATE TABLE IF NOT EXISTS Semesters (
    semester VARCHAR(11) PRIMARY KEY, -- e.g., "2025-2026-1"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT FALSE -- Indicates if this is the current semester
);
-- Ensure only one semester can be marked as current
CREATE UNIQUE INDEX idx_unique_current_semester ON Semesters(is_current) WHERE is_current = TRUE;
-- Insert semester values
INSERT INTO Semesters (semester, start_date, end_date, is_current) VALUES
('2025-2026-1', '2025-09-15', '2026-01-18', TRUE);

-- Create the Courses table
DROP TABLE IF EXISTS Courses;
CREATE TABLE IF NOT EXISTS Courses (
    course_id VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    en_course_name VARCHAR(255),
    unique_name VARCHAR(255),
    teacher_name VARCHAR(255),
    teacher_id VARCHAR(10),
    course_code VARCHAR(8),
    semester VARCHAR(11),
    type VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE, -- Default to active
    FOREIGN KEY (semester) REFERENCES Semesters(semester) ON DELETE SET NULL,
    UNIQUE (semester, course_code) -- Ensure no duplicate courses in the same semester
);

-- Create the CourseSchedules table
DROP TABLE IF EXISTS CourseSchedules;
CREATE TABLE IF NOT EXISTS CourseSchedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    semester VARCHAR(11) NOT NULL,
    course_code VARCHAR(20) NOT NULL,
    weeks BINARY(16),
    day_of_week TINYINT CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
    period_start TINYINT CHECK (period_start BETWEEN 1 AND 14),
    period_end TINYINT CHECK (period_end BETWEEN 1 AND 14),
    FOREIGN KEY (semester) REFERENCES Semesters(semester) ON DELETE SET NULL,
    FOREIGN KEY (semester, course_code) REFERENCES Courses(semester, course_code) ON DELETE CASCADE -- Ensure schedules are deleted if course is deleted
);

-- Create the Assignments table
DROP TABLE IF EXISTS Assignments;
CREATE TABLE IF NOT EXISTS Assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY, -- Auto-incrementing ID for each assignment
    course_id VARCHAR(20) NOT NULL,
    course_name_and_code VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    due_date DATETIME, -- Assuming ddl is a datetime
    description TEXT,
    annex_link VARCHAR(255),
    is_submitted BOOLEAN DEFAULT FALSE,
    is_ignored BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE -- Ensure assignments are deleted if course is deleted
);