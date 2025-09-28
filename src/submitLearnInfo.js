import { TaskManager } from "./managerTasks.js";

/**
 * Submit courses and assignments information to Cloudflare D1 database.
 * @param {D1Database} database Cloudflare D1 database instance.
 * @param {string} semester The semester for the courses and assignments.
 * @param {string} courses JSON string of courses, can be parsed into an array of course objects.
 * Each course is a object of the form { id: _course_id_, name: [_course_name_, _en_course_name_], teacher: [_teacher_name_, _teacher_id_], unique_name: _unique_name_ }.
 * @param {string} assignments JSON string of assignments, can be parsed into a object mapping course IDs to arrays of assignment objects.
 * Each assignment is a object of the form { title: _title_, due_date: _due_date_, description: _description_, file_link: _file_link_, is_submitted: _is_submitted_ }.
 * @returns {Object} An object containing counts of course insertions, assignment insertions, assignment updates, and failures.
 */
async function submitLearnInfo_toDatabase(database, semester, courses, assignments) {
    // Parse the JSON strings into array or object
    const parsedCourses = JSON.parse(courses);
    const parsedAssignments = JSON.parse(assignments);
    console.debug({
        message: 'Parsed courses and assignments.',
        parsedCourses,
        parsedAssignments
    })

    let courseInsertCount = 0;
    let assignmentInsertCount = 0;
    let assignmentUpdateCount = 0;
    let failCount = 0;

    // Insert semester if not exists
    const semesterQuery = await database.prepare('SELECT * FROM Semesters WHERE semester = ?')
        .bind(semester)
        .run();
    console.log({ 
        message: `Queried semester from database.`,
        semesterQuery
    });
    if (!semesterQuery.success) {
        // Initial query fails
        return { courseInsertCount, assignmentInsertCount, assignmentUpdateCount, failCount: parsedCourses.length };
    }
    if (semesterQuery.results.length === 0) {
        // Semester does not exist -> insert new semester
        const semesterInsert = await database.prepare('INSERT INTO Semesters (semester, start_date, end_date, is_current) VALUES (?, ?, ?, ?)')
            .bind(semester, new Date().toDateString(), 
                  (new Date() + 18 * 7 * 24 * 60 * 60 * 1000).toDateString(), 
                  1)
            .run();
        console.log({
            message: `Inserted new semester ${semester} into database.`,
            semesterInsert
        });
        if (!semesterInsert.success) {
            // Insertion fails
            return { courseInsertCount, assignmentInsertCount, assignmentUpdateCount, failCount: parsedCourses.length };
        }
    } else if (semesterQuery.results[0].is_current === 0) {
        // Semester exists but not current -> update to current
        const semesterUpdate = await database.prepare('UPDATE Semesters SET is_current = 1 WHERE semester = ?')
            .bind(semester)
            .run();
        console.log({
            message: `Updated semester ${semester} to current in database.`,
            semesterUpdate
        });
        if (!semesterUpdate.success) {
            // Update fails
            return { courseInsertCount, assignmentInsertCount, assignmentUpdateCount, failCount: parsedCourses.length };
        }
    }

    // Find existing courses for the semester
    const courseQuery = await database.prepare('SELECT * FROM Courses WHERE semester = ?')
        .bind(semester)
        .run();
    console.log({
        message: `Queried existing courses from database.`,
        courseQuery
    });
    if (!courseQuery.success) {
        // Initial query fails
        return { courseInsertCount, assignmentInsertCount, assignmentUpdateCount, failCount: parsedCourses.length };
    }
    const existingCourses = courseQuery.results.reduce((acc, row) => {
        acc[row.course_id] = row;
        return acc;
    }, {});

    for (const course of parsedCourses) {
		// Extract course details
		const course_id = course.id;
		const course_name = course.name;
		const teacher = course.teacher;
		const course_code = course.course_code;
		const unique_name = course.unique_name;
        const course_name_and_code = `${course_name[0]} (${course_code})`;

        if (!existingCourses[course_id]) {
			// Course does not exist -> insert new course
            const courseInsert = await database.prepare('INSERT INTO Courses (course_id, course_name, en_course_name, unique_name, teacher_name, teacher_id, course_code, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(course_id, course_name[0], course_name[1], unique_name, teacher[0], teacher[1], course_code, semester)
                .run();

            console.log({
                message: `Inserted new course ${unique_name} (${course_id}) into database.`,
                courseInsert
            });
            if (!courseInsert.success) {
                failCount++;
                continue;
            }
            courseInsertCount++;
        }

        if (!parsedAssignments[course_id]) {
            continue;
        }

        // Find existing assignments for the course
        const assignmentQuery = await database.prepare('SELECT * FROM Assignments WHERE course_id = ?')
            .bind(course_id)
            .run();
        console.log({
            message: `Queried existing assignments for course ${unique_name} (${course_id}) from database.`,
            assignmentQuery
        });
        if (!assignmentQuery.success) {
            failCount++;
            continue;
        }
        const existingAssignments = assignmentQuery.results.reduce((acc, row) => {
            acc[row.title] = row;
            return acc;
        }, {});

        const assignmentsForCourse = parsedAssignments[course_id];
        for (const assignment of assignmentsForCourse) {
            // Extract assignment details
			const title = assignment.title;
			const due_date = assignment.due_date;
			const description = assignment.description;
			const file_link = assignment.file_link;
			const is_submitted = assignment.is_submitted ? 1 : 0;

            if (!existingAssignments[title]) {
                // Assignment does not exist -> insert new assignment
                const assignmentInsert = await database.prepare('INSERT INTO Assignments (course_id, course_name_and_code, title, due_date, description, annex_link, is_submitted) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .bind(course_id, course_name_and_code, title, due_date, description, file_link, is_submitted)
                    .run();

                console.log({
                    message: `Inserted new assignment ${title} for course ${unique_name} (${course_id}) into database.`,
                    assignmentInsert
                });
                if (!assignmentInsert.success) {
                    failCount++;
                    continue;
                }
                assignmentInsertCount++;
            } else {
				// Assignment exists -> check for updates
                const existingAssignment = existingAssignments[title];
                const assignment_id = existingAssignment.assignment_id;
                let update = false;

                if (existingAssignment.is_submitted !== is_submitted) {
                    // Update existing assignment's submission status
                    const assignmentUpdate = await database.prepare('UPDATE Assignments SET is_submitted = ? WHERE course_id = ? AND assignment_id = ?')
                        .bind(is_submitted, course_id, assignment_id)
                        .run();
                    console.log({
                        message: `Updated submission status of assignment ${assignment_id} (${title}) for course ${unique_name} (${course_id}) in database.`,
                        assignmentUpdate
                    });
                    if (!assignmentUpdate.success) {
                        failCount++;
                        continue; 
                    }
                    update = true;
                }

                if (existingAssignment.due_date !== due_date ||
                    existingAssignment.description !== description ||
                    existingAssignment.annex_link !== file_link) {
                    // Update existing assignment
                    const assignmentUpdate = await database.prepare('UPDATE Assignments SET due_date = ?, description = ?, annex_link = ? WHERE course_id = ? AND assignment_id = ?')
                        .bind(due_date, description, file_link, course_id, assignment_id)
                        .run();
                    console.log({
                        message: `Updated details${existingAssignment.due_date !== due_date ? ' (due_date)' : ''}${existingAssignment.description !== description ? ' (description)' : ''}${existingAssignment.annex_link !== file_link ? ' (annex_link)' : ''} for assignment ${assignment_id} (${title}) for course ${unique_name} (${course_id}) in database.`,
                        assignmentUpdate
                    });
                    if (!assignmentUpdate.success) {
                        failCount++;
                        continue;
                    }
                    update = true;
                }

                if (update) {
                    assignmentUpdateCount++;
                }
            }
        }
    }
    return { courseInsertCount, assignmentInsertCount, assignmentUpdateCount, failCount };
}

/**
 * Submit courses and assignments information to Todoist.
 * @param {Secret} authToken Cloudflare Secret containing the Todoist API token.
 * @param {Database} database Cloudflare D1 database instance for course and assignment data.
 * @param {string} semester The semester for the courses and assignments.
 * @returns {Object} An object containing counts of tasks added, tasks updated, and failures.
 */
async function submitLearnInfo_toTodoist(authToken, database, semester) {
    // Initialize TaskManager
    const taskManager = new TaskManager(await authToken.get());
    await taskManager.setWorkingProject(semester);
    await taskManager.initSections();

    // Create labels for courses
    const courseQuery = await database.prepare('SELECT * FROM Courses WHERE semester = ?')
        .bind(semester)
        .run();
    console.log({
        message: `Queried courses from database for Todoist.`,
        courseQuery
    });
    if (!courseQuery.success) {
        return { taskAddCount: 0, taskUpdateCount: 0, failCount: 1 };
    }

    const courses = courseQuery.results;
    await taskManager.initCourses(courses);

    // Update tasks for assignments
    let taskAddCount = 0;
    let taskUpdateCount = 0;
    let failureCount = 0;
    
    for (const course of courses) {
        const course_id = course.course_id;
        const course_name = course.course_name;

        // Get assignments for the course
        const assignmentQuery = await database.prepare('SELECT * FROM Assignments WHERE course_id = ?')
            .bind(course_id)
            .run();
        console.log({
            message: `Queried assignments for course ${course_name} (${course_id}) from database for Todoist.`,
            assignmentQuery
        });
        if (!assignmentQuery.success) {
            failureCount++;
            continue;
        }

        const assignments = assignmentQuery.results;
        const result = await taskManager.updateAssignments(assignments);
        taskAddCount += result.taskAddCount;
        taskUpdateCount += result.taskUpdateCount;
        failureCount += result.failureCount;

        // Mark completed tasks as ignored in the database
        const completedTasks = result.toBeMarkedAsIgnored || [];
        for (const assignment of completedTasks) {
            const markIgnored = await database.prepare('UPDATE Assignments SET is_ignored = 1 WHERE assignment_id = ? AND course_id = ?')
                .bind(assignment.assignment_id, assignment.course_id)
                .run();
            console.log({
                message: `Marked assignment ${assignment.assignment_id} (${assignment.title}) as ignored in database.`,
                markIgnored
            });
            if (!markIgnored.success) {
                failureCount++;
            }
        }
    }
    return { taskAddCount, taskUpdateCount, failureCount };
}

export { submitLearnInfo_toDatabase, submitLearnInfo_toTodoist };