declare module "frappe-gantt" {
  interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress?: number;
    custom_class?: string;
    dependencies?: string;
  }

  interface GanttOptions {
    view_mode?: "Quarter Day" | "Half Day" | "Day" | "Week" | "Month";
    date_format?: string;
    language?: string;
    bar_height?: number;
    bar_corner_radius?: number;
    padding?: number;
    header_height?: number;
    column_width?: number;
    step?: number;
    on_click?: (task: GanttTask) => void;
    on_date_change?: (task: GanttTask, start: Date, end: Date) => void;
    on_progress_change?: (task: GanttTask, progress: number) => void;
    on_view_change?: (mode: string) => void;
  }

  class Gantt {
    constructor(
      element: SVGElement | HTMLElement | string,
      tasks: GanttTask[],
      options?: GanttOptions
    );
    change_view_mode(mode: string): void;
    refresh(tasks: GanttTask[]): void;
  }

  export default Gantt;
}
