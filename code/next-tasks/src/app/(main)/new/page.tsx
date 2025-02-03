import NewTaskForm from "@/components/NewTaskForm/NewTaskForm"

const NewtaskPage = () => {
  return (
    <div className="flex flex-col justify-center py-20">
        <h2 className="text-center text-2xl font-bold">Create New Task</h2>
        <NewTaskForm />
    </div>
  )
}

export default NewtaskPage