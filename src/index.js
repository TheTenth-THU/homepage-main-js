/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { submitLearnInfo_toDatabase, submitLearnInfo_toTodoist } from './submitLearnInfo.js';
import HtmlTemplate from './_template.js';

import HtmlIndex from './pages/index.html';
import HtmlSchedule from './pages/schedule.html';

export default {
    /**
     * @param {Request} request
     * @param {Object} env
     * @param {D1Database} env.assignments_d1 Cloudflare D1 database instance
     * @param {Secret} env.Todoist_Auth_Token Cloudflare Secret for Todoist API authentication
     */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		switch (url.pathname) {
            case '/':
                if (request.method == 'GET') {
                    // Serve the index HTML page
                    const html = new HtmlTemplate('Course Learning', HtmlIndex);
                    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                } else return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });
            case '/schedule':
                if (request.method == 'GET') {
                    // Parse parameters if any
                    semesterQuery = env.assignments_d1.prepare('SELECT * FROM Semesters WHERE is_current = TRUE LIMIT 1').run();
                    if (semesterQuery.results.length > 0) {
                        semester = semesterQuery.results[0].semester;
                        semester_start = semesterQuery.results[0].start_date;
                        semester_end = semesterQuery.results[0].end_date;
                    } else {
                        return new Response('No current semester found in the database.', { status: 500, statusText: 'Internal Server Error' });
                    }
                    // Serve the schedule HTML page
                    const html = new HtmlTemplate('Course Schedule', HtmlSchedule);
                    html.addCssFileToHead('styles/schedule.css');
                    html.addScriptFileToBody('scripts/schedule.js');
                    // Query database for existing entries
                    scheduleQuery = env.assignments_d1.prepare('SELECT * FROM CourseSchedules WHERE semester = ?').all(semester);
                    coursesQuery = env.assignments_d1.prepare('SELECT * FROM Courses WHERE semester = ?').all(semester);
                    // Inject data into the page
                    html.appendToMain(`<script>
                        const semester = ${JSON.stringify(semester)};
                        const semester_start = ${JSON.stringify(semester_start)};
                        const semester_end = ${JSON.stringify(semester_end)};
                        const existingSchedules = ${JSON.stringify(scheduleQuery.results)};
                        const existingCourses = ${JSON.stringify(coursesQuery.results)};
                        schedulePagePrepare(semester, semester_start, semester_end, existingSchedules, existingCourses);
                    </script>`);
                    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
                } else return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });
            case '/submit/learn':
                if (request.method == 'POST') {
                    // Handle the form submission
					const formData = await request.formData();
                    console.debug({ 
                        message: 'Received form data for /submit/learn:',
                        formData: Object.fromEntries(formData.entries())
                    });
					const semester = formData.get('semester');
					const courses = formData.get('courses');
					const assignments = formData.get('assignments');
					// Submit the data to the database
					const result_toDatabase = await submitLearnInfo_toDatabase(env.assignments_d1, semester, courses, assignments);
                    const result_toTodoist = await submitLearnInfo_toTodoist(env.Todoist_Auth_Token, env.assignments_d1, semester);
                    // Return a success response
                    console.debug({
                        message: 'Submission results',
                        result_toDatabase,
                        result_toTodoist
                    });
					return new Response(
						JSON.stringify({ result_toDatabase, result_toTodoist }), 
						{ status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json; charset=utf-8' } }
					);
				} else return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });
                
            case '/submit/schedule':
                if (request.method == 'POST') {
                    // Handle the form submission
                    const formData = await request.formData();
                    console.debug({ 
                        message: 'Received form data for /submit/schedule:',
                        formData: Object.fromEntries(formData.entries())
                    });
                    const semester = formData.get('semester');
                    const courseSchedules = formData.get('course_schedules');
                    // Submit the data to the database
                    const result = await submitCourseRegistration(env.assignments_d1, semester, courseSchedules);
                    // Return a success response
                    console.debug({
                        message: 'Submission results',
                        result
                    });
                    return new Response(
                        JSON.stringify(result), 
                        { status: 200, statusText: 'OK', headers: { 'Content-Type': 'application/json; charset=utf-8' } }
                    );
                } else return new Response('Method Not Allowed', { status: 405, statusText: 'Method Not Allowed' });

			default:
				return new Response('Not Found', { status: 404 });
		}
	},
};

