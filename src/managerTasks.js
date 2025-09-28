import { TodoistApi } from '@doist/todoist-api-typescript'

/**
 * Manages tasks with projects and sections of Todoist.
 */
class TaskManager {
    /**
     * Creates an instance of TaskManager.
     * 
     * @param {string} token The API token for Todoist.
     */
    constructor(token) {
        this.todoist = new TodoistApi(token);
        this.workingProject = null;
        this.workingSection = null;
        this.workingTask = null;
    }

    /**
     * Set the working project to the specified semester.
     * 
     * @param {string} semester The semester to set as the working project.
     */
    async setWorkingProject(semester) {
        const projects = (await this.todoist.getProjects()).results;
        console.debug({
            message: 'Fetched projects from Todoist',
            projects
        });

        this.workingProject = projects.find(project => project.name === semester);
        if (!this.workingProject) {
            this.workingProject = await this.todoist.addProject({ name: semester });
            console.log({
                message: 'Created new project for semester',
                semester: semester,
                projectId: this.workingProject.id
            })
        } else {
            console.log({
                message: 'Using existing project for semester',
                semester: semester,
                projectId: this.workingProject.id
            })
        }
    }

    /**
     * Initialize the sections for the working project or a specified project.
     * 
     * Create 'Assignments', 'Exams', 'Activities' and 'Projects' sections in the working project or the specified project, and **set the working section to 'Assignments'**.
     * 
     * @param {string} projectId The ID of the project to initialize sections for. If not provided, uses the working project.
     */
    async initSections(projectId = null) {
        if (!this.workingProject && !projectId) {
            throw new Error('No working project set. Please set a working project first.');
        }
        const targetProjectId = projectId || this.workingProject.id;
        const sections = (await this.todoist.getSections({ projectId: targetProjectId })).results;
        for (const sectionName of ['Exams', 'Activities', 'Projects']) {
            if (!sections.find(section => section.name === sectionName)) {
                await this.todoist.addSection({ projectId: targetProjectId, name: sectionName });
                console.log({
                    message: 'Created new section in project',
                    projectId: targetProjectId,
                    sectionName: sectionName
                })
            }
        }
        this.workingSection = sections.find(section => section.name === 'Assignments');
        if (!this.workingSection) {
            this.workingSection = await this.todoist.addSection({ projectId: targetProjectId, name: 'Assignments' });
        }
    }

    /**
     * Create labels for courses.
     * 
     * @param {Array} courses An array of course objects, each containing `course_code` and `course_name` properties.
     */
    async initCourses(courses) {
        const labelNames = courses.map(course => `${course.course_name} (${course.course_code})`);
        const colorChoices = ['berry_red', 'red', 'orange', 'yellow', 'olive_green', 
                              'lime_green', 'green', 'mint_green', 'teal', 'sky_blue', 
                              'light_blue', 'blue', 'grape', 'violet', 'lavender', 
                              'magenta', 'salmon', 'charcoal', 'grey', 'taupe'];
        const labels = (await this.todoist.getLabels()).results;
        let colorIndex = 0;
        for (const labelName of labelNames) {
            if (!labels.find(label => label.name === labelName)) {
                await this.todoist.addLabel({ name: labelName, color: colorChoices[colorIndex % colorChoices.length] });
                console.log({
                    message: 'Created new label for course',
                    courseName: labelName
                });
                colorIndex++;
            }
        }
    }

    /**
     * Update a list of assignments to the working section.
     *
     * This method will:
     * - **create new tasks** for the assignments that are not in the working section, 
     * - **update the due date and priority** for the assignments that are already in the working section, and 
     * - **complete the tasks** for the assignments that are submitted or ignored. Submitted assignments which are not active in the working section will be ignored.
     * 
     * Priority of each `assignment` is set based on the due date, so `assignment.due_date` should be a valid date string as `YYYY-MM-DDTHH:MM+08:00`. 
     * - If `assignment.due_date` is more than 3 days away, the priority is set to 2,
     * - If `assignment.due_date` is within 3 days, the priority is set to 3, and
     * - If `assignment.due_date` is in the past, the priority is set to 4.
     *
     * @param {Array} assignments An array of assignment objects, each containing `course_name_and_code`, `title`, `due_date`, `description`, `is_submitted` and `is_ignored` properties.
     * @returns {Object} An object containing counts of task additions, updates, and failures.
     */
    async updateAssignments(assignments) {
        if (!this.workingSection) {
            throw new Error('No working section set. Please set a working section first.');
        }
        const tasks = (await this.todoist.getTasks({ sectionId: this.workingSection.id })).results;
        let taskAddCount = 0;
        let taskUpdateCount = 0;
        let failureCount = 0;
        let toBeMarkedAsIgnored = [];

        for (const assignment of assignments) {
            // Extract assignment details
            const taskContent = `${assignment.course_name_and_code.slice(0, -11)} **${assignment.title}**`;
            const datetime = new Date(new Date(assignment.due_date) - 1 * 60 * 60 * 1000); // Due date minus 1 hour
            const dueString = datetime.toLocaleString('zh-CN', { hour12: false });
            const duration = 1 * 60;
            const durationUnit = 'minute';
            let priority = 2;
            if (datetime - Date.now() < 3 * 24 * 60 * 60 * 1000) {
                priority = 3;
            }
            if (datetime < Date.now()) {
                priority = 4;
            }

            // Check if the task already exists
            let task = tasks.find(t => t.content === taskContent);
            if (!task) {
                // Assignment has not been added, or has been removed (submitted or ignored)
                if (!assignment.is_submitted && !assignment.is_ignored) {
                    // Assignment has not been added, or has just been ignored without update
                    let completedTasks;
                    try {
                        completedTasks = (await this.todoist.getCompletedTasksByDueDate({
                            since: new Date(datetime - 1 * 24 * 60 * 60 * 1000).toISOString(),
                            until: new Date(datetime + 1 * 24 * 60 * 60 * 1000).toISOString()
                        })).items;
                        console.debug({
                            message: `Fetched completed tasks for assignment '${assignment.title}'`,
                            assignmentTitle: assignment.title,
                            originalDueDate: assignment.due_date,
                            adjustedDueDate: dueString,
                            since: new Date(datetime.valueOf() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                            until: new Date(datetime.valueOf() + 1 * 24 * 60 * 60 * 1000).toISOString(),
                            completedTasks: completedTasks || []
                        });
                    } catch (error) {
                        console.error({
                            message: 'Failed to fetch completed tasks for assignment',
                            assignmentTitle: assignment.title,
                            error: error
                        });
                        failureCount++;
                        continue;
                    }
                    if (completedTasks && completedTasks.find(t => t.content === taskContent)) {
                        // Assignment has been completed -> mark as ignored
                        toBeMarkedAsIgnored.push(assignment);
                        console.log({
                            message: 'Assignment already completed, skipping addition and marking as ignored',
                            assignmentTitle: assignment.title
                        });
                        assignment.is_ignored = true;
                    } else {
                        // Assignment has not been added -> add the task
                        try {
                            let task = await this.todoist.addTask({
                                content: taskContent,
                                description: assignment.description,
                                dueString: dueString,
                                duration: duration,
                                durationUnit: durationUnit,
                                labels: [assignment.course_name_and_code],
                                priority: priority,
                                sectionId: this.workingSection.id
                            });
                            console.log({
                                message: 'Created new task for assignment',
                                assignmentTitle: assignment.title,
                                dueString: dueString,
                                labels: [assignment.course_name_and_code],
                                taskId: task.id
                            });
                            taskAddCount++;
                        } catch (error) {
                            console.error({
                                message: `Failed to add task for assignment ${assignment.title}`,
                                error: error
                            });
                            failureCount++;
                            continue;
                        }
                    }
                } else {
                    // Assignment has been removed (submitted or ignored) -> do nothing
                }
            } else {
                // Assignment has been added -> update existing task
                if (assignment.is_submitted || assignment.is_ignored) {
                    // Assignment is submitted or ignored -> complete the task
                    try {
                        await this.todoist.closeTask(task.id);
                        console.log({
                            message: 'Closed task for submitted or ignored assignment',
                            assignmentTitle: assignment.title,
                            taskId: task.id
                        });
                        taskUpdateCount++;
                    } catch (error) {
                        console.error({
                            message: `Failed to close task for assignment ${assignment.title}`,
                            error: error
                        });
                        failureCount++;
                    }
                } else {
                    // Assignment is active -> update the task
                    try {
                        if (task.due?.date !== assignment.due_date || 
                            task.priority !== priority ||
                            task.description !== assignment.description ||
                            !task.labels.includes(assignment.course_name_and_code)) {
                            await this.todoist.updateTask(task.id, {
                                description: assignment.description,
                                dueString: dueString,
                                duration: duration,
                                durationUnit: durationUnit,
                                labels: [assignment.course_name_and_code],
                                priority: priority
                            });
                            console.log({
                                message: 'Updated task for assignment',
                                assignmentTitle: assignment.title,
                                dueString: dueString,
                                labels: [assignment.course_name_and_code],
                                priority: priority
                            });
                            taskUpdateCount++;
                        }
                    } catch (error) {
                        console.error({
                            message: `Failed to update task for assignment ${assignment.title}`,
                            error: error
                        });
                        failureCount++;
                    }
                }
            }
        }
        return { taskAddCount, taskUpdateCount, failureCount, toBeMarkedAsIgnored };
    }
}

export { TaskManager };