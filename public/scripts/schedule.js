function schedulePagePrepare(semester, semester_start, semester_end, existingSchedules, existingCourses) {
    // Initialize the calendar
    const today = new Date();
    const semesterStart = new Date(semester_start);
    const semesterEnd = new Date(semester_end);
    // Calculate current week number
    const weekNum = Math.floor((today - semesterStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const weekStart = new Date(semesterStart.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
    // Display week info
    document.getElementById('semester').textContent = semester;
    document.getElementById('week-num').textContent = `Week ${weekNum}`;
    document.getElementById('mon-date').textContent = weekStart.toLocaleDateString();
    document.getElementById('tue-date').textContent = new Date(weekStart.getTime() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString();
    document.getElementById('wed-date').textContent = new Date(weekStart.getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString();
    document.getElementById('thu-date').textContent = new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString();
    document.getElementById('fri-date').textContent = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString();
    document.getElementById('sat-date').textContent = new Date(weekStart.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString();
    document.getElementById('sun-date').textContent = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString();

    
}
