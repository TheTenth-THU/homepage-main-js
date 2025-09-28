async function submitCourseRegistration(database, semester, courseSchedules) {
    // Parse the JSON string into an array
    const parsedSchedules = JSON.parse(courseSchedules);
    console.debug({
        message: 'Parsed course schedules',
        parsedSchedules
    });

    let scheduleInsertCount = 0;
    let scheduleUpdateCount = 0;
    let failCount = 0;

    // Find existing course schedules for the semester
    const scheduleQuery = await database.prepare('SELECT * FROM CourseSchedules WHERE semester = ?')
        .bind(semester)
        .run();
    console.log(`${scheduleQuery.success ? 'Success' : 'Failed'} to query existing course schedules from database.`);
    if (!scheduleQuery.success) {
        // Initial query fails
        return { scheduleInsertCount, scheduleUpdateCount, failCount: parsedSchedules.length };
    }
    const existingSchedules = scheduleQuery.results.reduce((acc, row) => {
        if (!acc[row.course_code]) {
            acc[row.course_code] = [];
        }
        acc[row.course_code].push(row);
        return acc;
    }, {});

    for (const schedule of parsedSchedules) {
        // Extract schedule details
        const weekString = schedule.week;
        const dayOfWeekString = schedule.weekday;
        const timeString = schedule.time;
    }
}