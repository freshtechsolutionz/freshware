"use client";

import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState } from "react";

type Task = {
  task_id: string;
  title: string | null;
  status: "New" | "In Progress" | "Blocked" | "Done";
};

type Props = {
  projectId: string;
  tasks: Task[];
};

const columnsOrder: Task["status"][] = [
  "New",
  "In Progress",
  "Blocked",
  "Done",
];

export default function ProjectKanban({ projectId, tasks }: Props) {
  const [items, setItems] = useState(tasks);

  async function updateStatus(taskId: string, status: Task["status"]) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function onDragEnd(result: any) {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as Task["status"];

    const updated = items.map((t) =>
      t.task_id === taskId ? { ...t, status: newStatus } : t
    );

    setItems(updated);
    updateStatus(taskId, newStatus);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columnsOrder.map((status) => {
          const colTasks = items.filter((t) => t.status === status);

          return (
            <Droppable key={status} droppableId={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="bg-gray-50 rounded-2xl p-4 min-h-[300px]"
                >
                  <div className="font-semibold mb-3">{status}</div>

                  {colTasks.map((task, index) => (
                    <Draggable
                      key={task.task_id}
                      draggableId={task.task_id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-white p-3 mb-3 rounded-xl shadow-sm border"
                        >
                          {task.title}
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}
